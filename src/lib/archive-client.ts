import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { eq, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { archiveIndex, siteSettings } from "@/db/schema";
import { embedMany, embeddingsDisponibles } from "./embeddings";
import { clearHits, usoUnico } from "./rate-limit";

/**
 * Cliente de SOLO LECTURA de la API del sistema actual (contextoganadero.com).
 *
 * Principio de arquitectura #1: los ~41.000 artículos existentes permanecen en el
 * sistema actual con sus URLs intactas. Aquí solo se construye un espejo de
 * metadatos + embeddings en `archive_index`. NUNCA se escribe de vuelta.
 *
 * La sincronización es REANUDABLE (H-15): la carga completa (~41.000 notas, a unas 100 por página) no cabe en los
 * 300 s de una ejecución, así que el cursor de la pasada se guarda en `site_settings` (`archive_sync`) tras cada
 * página y la siguiente ejecución sigue donde quedó. Cada registro se valida por separado (uno malo se descarta y
 * se cuenta, no aborta la pasada), los embeddings se piden en lote y, al terminar una pasada completa, lo que ya no
 * existe en el origen se retira del índice.
 */

/** Tope de tiempo de una ejecución, con margen bajo los 300 s de `maxDuration` de las rutas que la llaman. */
const PRESUPUESTO_MS = 240_000;
/** Cada cuánto se repite una pasada completa (la única que detecta notas borradas en el origen). */
const PASADA_COMPLETA_CADA_MS = 7 * 24 * 3600_000;
// Clave de `site_settings` donde se guarda el progreso.
const ESTADO_KEY = "archive_sync";
// Candado entre ejecuciones simultáneas (cron + manual): vence solo si una ejecución muere.
const CANDADO = "archive-sync:lock";

// Una URL canónica solo es válida si es https y sin credenciales: luego se muestra como enlace y se rastrea.
const esUrlHttps = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
};
// Texto opcional con tope de longitud; el vacío o ausente queda en null.
const textoOpcional = (max: number) => z.string().max(max).nullish().transform((v) => v || null);

/** Forma de un artículo tal como se acepta de la API del archivo histórico. Todo lo demás se descarta o se recorta. */
const itemApi = z.object({
  id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1).max(200)),
  url: z.string().max(2000).refine(esUrlHttps, "la URL canónica debe ser https"),
  title: z.string().trim().min(1).max(500),
  summary: z.string().max(10_000).nullish().transform((v) => v ?? ""),
  category: textoOpcional(200),
  // Una fecha ilegible no invalida el artículo: queda sin fecha.
  publishedAt: z
    .string()
    .nullish()
    .transform((v) => {
      const d = v ? new Date(v) : null;
      return d && !Number.isNaN(d.getTime()) ? d : null;
    }),
  // Texto plano para calcular el embedding y el hash de cambio. No se persiste.
  contentText: textoOpcional(200_000),
});

// Artículo validado de la API del archivo histórico.
export type ArchiveApiItem = z.output<typeof itemApi>;

// Página de resultados de la API: artículos (sin validar todavía) y cursor de la página siguiente.
type ListResponse = { items: unknown[]; nextCursor: string | null };

/** Error de la API origen: solo el código de estado, nunca el cuerpo de una respuesta ajena. */
export class ArchiveApiError extends Error {
  constructor(readonly status: number) {
    super(`archive API ${status}`);
    this.name = "ArchiveApiError";
  }
}

// Pausa entre reintentos.
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Pide una página de 100 artículos a la API (solo lectura), opcionalmente solo los actualizados desde una fecha.
 * Tiene tiempo máximo y reintenta con espera creciente ante errores de red, 429 y 5xx.
 */
async function fetchPage(cursor: string | null, since: string | null): Promise<ListResponse> {
  const base = process.env.ARCHIVE_API_BASE_URL;
  if (!base) throw new Error("ARCHIVE_API_BASE_URL no configurada");
  // Ruta relativa sobre una base con barra final: conserva cualquier ruta de la base (p. ej. /api/v2/). Con
  // `new URL("/articles", base)` esa ruta se perdía en silencio.
  const url = new URL("articles", base.endsWith("/") ? base : `${base}/`);
  url.searchParams.set("limit", "100");
  if (cursor) url.searchParams.set("cursor", cursor);
  if (since) url.searchParams.set("updatedSince", since);
  const key = process.env.ARCHIVE_API_KEY;

  let motivo = "sin respuesta";
  for (let intento = 0; intento < 3; intento++) {
    try {
      const res = await fetch(url, {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
        // El archivo cambia poco; cachear no es crítico y el job corre en background.
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 429 || res.status >= 500) {
        motivo = `estado ${res.status}`;
        await esperar(1000 * 2 ** intento);
        continue;
      }
      if (!res.ok) throw new ArchiveApiError(res.status);
      const json = (await res.json()) as { items?: unknown; nextCursor?: unknown };
      if (!Array.isArray(json.items)) throw new Error("archive API: respuesta sin lista de artículos");
      return { items: json.items, nextCursor: typeof json.nextCursor === "string" && json.nextCursor ? json.nextCursor : null };
    } catch (e) {
      if (e instanceof ArchiveApiError || (e instanceof Error && e.message.startsWith("archive API:"))) throw e;
      motivo = (e as Error)?.name ?? "error de red";
      await esperar(1000 * 2 ** intento);
    }
  }
  throw new Error(`archive API sin respuesta (${motivo})`);
}

// Huella SHA-256 del contenido origen: sirve para saber si un artículo cambió sin volver a calcular su embedding.
function hashOf(item: ArchiveApiItem): string {
  return createHash("sha256")
    .update(`${item.title}\n${item.summary}\n${item.contentText ?? ""}`)
    .digest("hex");
}

// Pasada en curso: de dónde viene el cursor y cuánto va hecho.
type Pasada = {
  id: string;
  tipo: "completa" | "incremental";
  /** `updatedSince` de una pasada incremental; null en la completa. */
  desde: string | null;
  cursor: string | null;
  iniciada: string;
  escaneadas: number;
  guardadas: number;
  sinCambios: number;
  invalidas: number;
};
// Progreso guardado entre ejecuciones.
type EstadoSync = { pasada?: Pasada | null; ultimaCompleta?: string; ultimaIncremental?: string };

// Lee el progreso guardado (vacío si no hay o si la lectura falla).
async function leerEstado(): Promise<EstadoSync> {
  const [row] = await db.select({ v: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, ESTADO_KEY)).limit(1);
  return (row?.v as EstadoSync | undefined) ?? {};
}
// Guarda el progreso.
async function guardarEstado(e: EstadoSync) {
  await db
    .insert(siteSettings)
    .values({ key: ESTADO_KEY, value: e })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: e, updatedAt: new Date() } });
}

// Resumen de una ejecución de sincronización.
export type SyncResult = {
  tipo: "completa" | "incremental";
  /** Artículos vistos, guardados (nuevos o cambiados), sin cambios y descartados por no ser válidos. */
  scanned: number;
  upserted: number;
  skipped: number;
  invalid: number;
  /** Artículos retirados del índice por haber desaparecido del origen (solo al cerrar una pasada completa). */
  removed: number;
  /** Retirados que se NO se aplicaron por ser demasiados de golpe (posible fallo del origen): revisar a mano. */
  removedSuspicious: number;
  /** `true` si la pasada terminó; `false` si quedó a medias y la próxima ejecución la sigue. */
  completa: boolean;
  /** `true` si otra ejecución estaba en curso y esta no hizo nada. */
  ocupada: boolean;
};

// Texto del que se calcula el embedding de un artículo.
const textoDe = (i: ArchiveApiItem) => `${i.title}\n\n${i.summary}\n\n${i.contentText ?? ""}`;

/**
 * Procesa una página: valida cada registro, deja sin tocar lo que no cambió (solo lo marca como visto), calcula en
 * lote los embeddings de lo nuevo o cambiado y lo guarda con un solo UPSERT. Un registro inválido se cuenta y se omite.
 */
async function procesarPagina(items: unknown[], pasada: Pasada): Promise<void> {
  const validos = new Map<string, ArchiveApiItem>();
  const vistosInvalidos: string[] = [];
  for (const raw of items) {
    const p = itemApi.safeParse(raw);
    if (p.success) validos.set(p.data.id, p.data);
    else {
      pasada.invalidas++;
      // Un registro que existía y hoy llega malformado no se da por borrado: se conserva tal cual.
      const id = (raw as { id?: unknown } | null)?.id;
      if (typeof id === "string" || typeof id === "number") vistosInvalidos.push(String(id).slice(0, 200));
    }
  }
  pasada.escaneadas += items.length;

  const ids = [...validos.keys()];
  const existentes = ids.length
    ? await db
        .select({ id: archiveIndex.externalId, hash: archiveIndex.sourceHash, conEmbedding: sql<boolean>`${archiveIndex.embedding} is not null` })
        .from(archiveIndex)
        .where(inArray(archiveIndex.externalId, ids))
    : [];
  const previo = new Map(existentes.map((e) => [e.id, e]));
  const puedeEmbeber = embeddingsDisponibles();

  const nuevos: ArchiveApiItem[] = [];
  const iguales: string[] = [];
  for (const item of validos.values()) {
    const e = previo.get(item.id);
    // Sin cambios solo si el hash coincide Y ya tiene embedding (o no hay proveedor para calcularlo).
    if (e && e.hash === hashOf(item) && (e.conEmbedding || !puedeEmbeber)) iguales.push(item.id);
    else nuevos.push(item);
  }

  // Todo lo visto se marca con la hora de esta pasada: es lo que permite detectar, al final, lo que ya no está.
  const vistos = [...iguales, ...vistosInvalidos];
  if (vistos.length) await db.update(archiveIndex).set({ syncedAt: new Date() }).where(inArray(archiveIndex.externalId, vistos));
  pasada.sinCambios += iguales.length;

  if (nuevos.length) {
    const vectores = await embedMany(nuevos.map(textoDe));
    const filas = nuevos.map((item, i) => ({
      externalId: item.id,
      canonicalUrl: item.url,
      title: item.title,
      summary: item.summary,
      legacyCategory: item.category,
      publishedAt: item.publishedAt,
      // Si había proveedor y el embedding falló, el hash queda vacío: la próxima pasada lo ve «cambiado» y reintenta.
      sourceHash: puedeEmbeber && !vectores[i] ? "" : hashOf(item),
      embedding: vectores[i],
    }));
    await db
      .insert(archiveIndex)
      .values(filas)
      .onConflictDoUpdate({
        target: archiveIndex.externalId,
        set: {
          canonicalUrl: sql`excluded.canonical_url`,
          title: sql`excluded.title`,
          summary: sql`excluded.summary`,
          legacyCategory: sql`excluded.legacy_category`,
          publishedAt: sql`excluded.published_at`,
          sourceHash: sql`excluded.source_hash`,
          // Un embedding que no se pudo calcular no borra el anterior: sigue siendo útil hasta que llegue el nuevo.
          embedding: sql`coalesce(excluded.embedding, ${archiveIndex.embedding})`,
          syncedAt: sql`now()`,
        },
      });
    pasada.guardadas += nuevos.length;
  }
}

/**
 * Cierra una pasada completa: lo que no se vio en ella ya no existe en el origen y se retira del índice. Con una red de
 * seguridad: si fueran muchos de golpe (más del 20 % del índice y más de 50), lo más probable es un fallo del origen y no
 * un borrado real, así que no se toca nada y se avisa.
 */
async function retirarAusentes(pasada: Pasada): Promise<{ removed: number; removedSuspicious: number }> {
  const inicio = new Date(pasada.iniciada);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(archiveIndex);
  const [{ ausentes }] = await db.select({ ausentes: sql<number>`count(*)::int` }).from(archiveIndex).where(lt(archiveIndex.syncedAt, inicio));
  if (!ausentes) return { removed: 0, removedSuspicious: 0 };
  if (ausentes > 50 && ausentes > total * 0.2) {
    console.warn(`archive-sync: ${ausentes} de ${total} artículos no aparecieron en la pasada completa; no se retiran (revisar el origen).`);
    return { removed: 0, removedSuspicious: ausentes };
  }
  await db.delete(archiveIndex).where(lt(archiveIndex.syncedAt, inicio));
  return { removed: ausentes, removedSuspicious: 0 };
}

/** Opciones de una ejecución. */
export type OpcionesSync = {
  /** Fuerza (o sigue) una pasada completa de todo el archivo. */
  full?: boolean;
  /** Descarta la pasada en curso y empieza de cero. */
  reiniciar?: boolean;
  /** Tiempo máximo de esta ejecución; por defecto 240 s. Siempre se procesa al menos una página. */
  presupuestoMs?: number;
};

/**
 * Sincroniza el índice y devuelve cuánto avanzó. Es REANUDABLE: si el tiempo se acaba antes de terminar, el cursor
 * queda guardado y la siguiente ejecución sigue ahí (`completa: false`). Sin `full`, hace una pasada incremental (lo
 * actualizado desde la última) y, cada 7 días o si nunca se hizo, una completa, que además retira lo borrado en el origen.
 * Idempotente: solo vuelve a calcular el embedding cuando cambia el contenido.
 */
export async function syncArchiveIndex(opciones: OpcionesSync = {}): Promise<SyncResult> {
  const resultado = (p: Pasada, extra: Partial<SyncResult>): SyncResult => ({
    tipo: p.tipo,
    scanned: 0,
    upserted: 0,
    skipped: 0,
    invalid: 0,
    removed: 0,
    removedSuspicious: 0,
    completa: false,
    ocupada: false,
    ...extra,
  });
  const vacia: Pasada = { id: "", tipo: "incremental", desde: null, cursor: null, iniciada: new Date().toISOString(), escaneadas: 0, guardadas: 0, sinCambios: 0, invalidas: 0 };

  // Una sola ejecución a la vez (cron y disparo manual podrían solaparse).
  if (!(await usoUnico(CANDADO, 330))) return resultado(vacia, { ocupada: true });
  try {
    const estado = await leerEstado();
    let pasada = opciones.reiniciar ? null : (estado.pasada ?? null);
    if (opciones.full && pasada && pasada.tipo !== "completa") pasada = null; // una completa pedida a mano reemplaza a una incremental a medias
    if (!pasada) {
      const ahora = Date.now();
      const ultimaCompleta = estado.ultimaCompleta ? Date.parse(estado.ultimaCompleta) : 0;
      const toca = opciones.full || !ultimaCompleta || ahora - ultimaCompleta > PASADA_COMPLETA_CADA_MS;
      const ultima = Math.max(ultimaCompleta, estado.ultimaIncremental ? Date.parse(estado.ultimaIncremental) : 0);
      pasada = {
        id: randomUUID(),
        tipo: toca ? "completa" : "incremental",
        // Un día de solape con la pasada anterior, por si algo cambió mientras ella corría.
        desde: toca ? null : new Date(ultima ? ultima - 24 * 3600_000 : ahora - 3 * 24 * 3600_000).toISOString(),
        cursor: null,
        iniciada: new Date(ahora).toISOString(),
        escaneadas: 0,
        guardadas: 0,
        sinCambios: 0,
        invalidas: 0,
      };
    }

    const antes = { escaneadas: pasada.escaneadas, guardadas: pasada.guardadas, sinCambios: pasada.sinCambios, invalidas: pasada.invalidas };
    const limite = Date.now() + (opciones.presupuestoMs ?? PRESUPUESTO_MS);
    let terminada = false;
    for (;;) {
      const pagina = await fetchPage(pasada.cursor, pasada.desde);
      await procesarPagina(pagina.items, pasada);
      pasada.cursor = pagina.nextCursor;
      if (!pagina.nextCursor) {
        terminada = true;
        break;
      }
      // El cursor se guarda tras CADA página: si la ejecución muere, la siguiente no repite lo hecho.
      await guardarEstado({ ...estado, pasada });
      if (Date.now() > limite) break;
    }

    let retiro = { removed: 0, removedSuspicious: 0 };
    if (terminada) {
      if (pasada.tipo === "completa") retiro = await retirarAusentes(pasada);
      await guardarEstado({
        pasada: null,
        ultimaCompleta: pasada.tipo === "completa" ? pasada.iniciada : estado.ultimaCompleta,
        ultimaIncremental: pasada.iniciada,
      });
    }
    return resultado(pasada, {
      scanned: pasada.escaneadas - antes.escaneadas,
      upserted: pasada.guardadas - antes.guardadas,
      skipped: pasada.sinCambios - antes.sinCambios,
      invalid: pasada.invalidas - antes.invalidas,
      completa: terminada,
      ...retiro,
    });
  } finally {
    await clearHits(CANDADO);
  }
}
