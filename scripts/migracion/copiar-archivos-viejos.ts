/**
 * Trae a nuestro almacenamiento («media» de Supabase) lo que las notas aún cargan de la infraestructura del sitio anterior
 * (`storage.contextoganadero.com`, `static.contextoganadero.com` y su bucket de Amazon): PDF, hojas de cálculo, zips, imágenes y videos.
 * Reescribe cada nota para que apunte a la copia, así el día que se apague aquello nada se rompe.
 *
 * Por defecto NO escribe: cuenta, clasifica y mide. Con `--aplicar` copia y reescribe; antes de cambiar una nota guarda su texto original en
 * `.migracion-cache/respaldo-archivos-viejos.jsonl`. Es idempotente (registro en `archivos-viejos.jsonl`): se puede repetir y reanudar.
 *
 * Las páginas HTML interactivas (crucigramas, simulador…) NO se copian: el almacenamiento no las puede ejecutar. Salen en el informe.
 *
 * Uso: npx tsx --conditions=react-server scripts/migracion/copiar-archivos-viejos.ts [--produccion] [--aplicar] [--limite=50]
 * Necesita DATABASE_URL (con --produccion) y SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, o un `.env.migracion` que los traiga.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { CACHE, credencialesStorage, dormir, pedir, prepararCache, urlBaseDeDatos } from "./comun";
import { clasificar, extension, nombreObjeto, referencias, reescribir, tipoMime } from "./archivos-viejos";

const bandera = (n: string) => process.argv.includes(`--${n}`);
const valor = (n: string, def: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? def;
const APLICAR = bandera("aplicar");
const LIMITE = Number(valor("limite", "100000"));
/** Bucket propio de los archivos heredados: «media» solo admite imágenes, audio y video, y su limpieza diaria borra lo no referenciado. */
const BUCKET = "archivos";
/** Tope por archivo: el almacenamiento rechaza lo que pase de su límite (50 MB por defecto). */
const MAX_BYTES = 45 * 1024 * 1024;
const REGISTRO = join(CACHE, "archivos-viejos.jsonl");
const RESPALDO = join(CACHE, "respaldo-archivos-viejos.jsonl");
const INFORME = join(CACHE, "informe-archivos-viejos.json");

type Entrada = { origen: string; url: string | null; bytes?: number; motivo?: string };

/** Lo ya copiado antes (solo vale lo subido a ESTE almacenamiento). */
function leerRegistro(urlBase: string): Map<string, Entrada> {
  const m = new Map<string, Entrada>();
  if (!existsSync(REGISTRO)) return m;
  for (const l of readFileSync(REGISTRO, "utf8").split("\n")) {
    if (!l) continue;
    try {
      const e = JSON.parse(l) as Entrada;
      if (e.url && !e.url.startsWith(`${urlBase}/`)) continue;
      m.set(e.origen, e);
    } catch {
      /* línea cortada */
    }
  }
  return m;
}

async function subir(cred: { url: string; key: string }, nombre: string, bytes: Buffer, tipo: string): Promise<void> {
  let ultimo = "";
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${cred.url}/storage/v1/object/${BUCKET}/${nombre}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cred.key}`, apikey: cred.key, "Content-Type": tipo, "x-upsert": "true", "cache-control": "max-age=31536000" },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(120_000),
    }).catch((e: unknown) => e as Error);
    if (r instanceof Response) {
      if (r.ok) return;
      ultimo = `HTTP ${r.status} ${(await r.text().catch(() => "")).slice(0, 120)}`;
      if (r.status === 400 || r.status === 413) break;
    } else ultimo = r.message;
    await dormir(1000 * (i + 1) ** 2);
  }
  throw new Error(`No se pudo subir ${nombre}: ${ultimo}`);
}

async function main() {
  prepararCache();
  if (bandera("produccion")) process.env.DATABASE_URL = urlBaseDeDatos();
  const { db } = await import("@/db");
  const { articles } = await import("@/db/schema");

  // Lectura por rangos de id (256 tandas por el primer byte del uuid): una sola consulta pasa del tiempo máximo de la conexión.
  const rangos = Array.from({ length: 256 }, (_, i) => {
    const h = (n: number) => n.toString(16).padStart(2, "0");
    return { desde: `${h(i)}000000-0000-0000-0000-000000000000`, hasta: i < 255 ? `${h(i + 1)}000000-0000-0000-0000-000000000000` : null };
  });
  const enRango = (r: { desde: string; hasta: string | null }) => (r.hasta ? sql`${articles.id} >= ${r.desde}::uuid and ${articles.id} < ${r.hasta}::uuid` : sql`${articles.id} >= ${r.desde}::uuid`);

  const notas: { id: string; legacy: string | null; slug: string; body: string }[] = [];
  for (const r of rangos) {
    if (notas.length >= LIMITE) break;
    notas.push(
      ...(await db
        .select({ id: articles.id, legacy: articles.legacyPath, slug: articles.slug, body: articles.body })
        .from(articles)
        .where(sql`${enRango(r)} and ${articles.body} ~* '(storage|static)\\.contextoganadero\\.com'`)
        .limit(LIMITE - notas.length)),
    );
  }

  // Inventario: qué archivos distintos hay, de qué clase, y en cuántas notas aparece cada uno.
  const usos = new Map<string, Set<string>>();
  for (const n of notas) for (const { origen } of referencias(n.body)) (usos.get(origen) ?? usos.set(origen, new Set()).get(origen)!).add(n.id);
  const porClase = { copiar: [] as string[], html: [] as string[], desconocida: [] as string[] };
  for (const o of usos.keys()) porClase[clasificar(o)].push(o);
  console.log(`Notas con referencias al sitio anterior: ${notas.length}`);
  console.log(`Archivos distintos: ${usos.size} → para copiar ${porClase.copiar.length} · páginas HTML ${porClase.html.length} · sin extensión conocida ${porClase.desconocida.length}`);
  const porExt = new Map<string, number>();
  for (const o of porClase.copiar) porExt.set(extension(o), (porExt.get(extension(o)) ?? 0) + 1);
  console.log("Por tipo:", Object.fromEntries([...porExt].sort((a, b) => b[1] - a[1])));

  if (!APLICAR) {
    // Sondeo ligero de lo que hoy responde, sin descargar nada.
    let vivos = 0;
    let caidos = 0;
    let bytes = 0;
    for (const o of porClase.copiar.slice(0, 40)) {
      const r = await fetch(o, { method: "HEAD", signal: AbortSignal.timeout(20_000) }).catch(() => null);
      if (r?.ok) {
        vivos++;
        bytes += Number(r.headers.get("content-length") ?? 0);
      } else caidos++;
    }
    console.log(`Sondeo de 40 archivos: ${vivos} responden, ${caidos} no · ${(bytes / 1048576).toFixed(1)} MB entre los que respondieron`);
    console.log("Simulacro: no se escribió nada. Repite con --aplicar para copiar y reescribir.");
    process.exit(0);
  }

  const cred = credencialesStorage();
  const registro = leerRegistro(cred.url);
  const anotar = (e: Entrada) => {
    registro.set(e.origen, e);
    appendFileSync(REGISTRO, JSON.stringify(e) + "\n");
  };

  // 1) Copiar cada archivo (de a pocos a la vez para no saturar el origen).
  let copiados = 0;
  let fallidos = 0;
  const cola = porClase.copiar.filter((o) => !registro.get(o)?.url);
  let i = 0;
  const trabajador = async () => {
    for (let o = cola[i++]; o; o = cola[i++]) {
      try {
        const r = await pedir(o, { timeoutMs: 120_000 });
        if (!r.ok) {
          fallidos++;
          anotar({ origen: o, url: null, motivo: `HTTP ${r.status}` });
          continue;
        }
        const largo = Number(r.headers.get("content-length") ?? 0);
        if (largo > MAX_BYTES) {
          fallidos++;
          anotar({ origen: o, url: null, motivo: `pesa ${(largo / 1048576).toFixed(0)} MB (tope ${MAX_BYTES / 1048576} MB)` });
          await r.body?.cancel();
          continue;
        }
        const bytes = Buffer.from(await r.arrayBuffer());
        if (bytes.length > MAX_BYTES) {
          fallidos++;
          anotar({ origen: o, url: null, motivo: "supera el tope de tamaño" });
          continue;
        }
        const nombre = nombreObjeto(o);
        await subir(cred, nombre, bytes, tipoMime(o));
        anotar({ origen: o, url: `${cred.url}/storage/v1/object/public/${BUCKET}/${nombre}`, bytes: bytes.length });
        copiados++;
        if (copiados % 25 === 0) console.log(`  ${copiados} archivos copiados…`);
      } catch (e) {
        fallidos++;
        appendFileSync(join(CACHE, "archivos-viejos-fallos.log"), `${o}\t${e instanceof Error ? e.message : String(e)}\n`);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, trabajador));
  console.log(`Archivos copiados: ${copiados} · fallidos: ${fallidos} · ya estaban: ${porClase.copiar.length - cola.length}`);

  // 2) Reescribir las notas (con respaldo del texto original).
  let reparadas = 0;
  for (const n of notas) {
    const { html, cambios } = reescribir(n.body, (o) => registro.get(o)?.url);
    if (!cambios || html === n.body) continue;
    appendFileSync(RESPALDO, JSON.stringify({ id: n.id, body: n.body }) + "\n");
    await db.update(articles).set({ body: html }).where(eq(articles.id, n.id));
    reparadas++;
    if (reparadas % 50 === 0) console.log(`  ${reparadas} notas reescritas…`);
  }
  console.log(`Notas reescritas: ${reparadas} de ${notas.length}`);

  // 3) Informe: lo que quedó sin copia (no pedirlo otra vez a ciegas) y las páginas HTML.
  const sinCopia = [...usos.keys()].filter((o) => clasificar(o) === "copiar" && !registro.get(o)?.url).map((o) => ({ origen: o, motivo: registro.get(o)?.motivo ?? "sin intentar", notas: usos.get(o)!.size }));
  writeFileSync(INFORME, JSON.stringify({ sinCopia, paginasHtml: porClase.html.map((o) => ({ origen: o, notas: usos.get(o)!.size })), sinExtension: porClase.desconocida }, null, 2));
  console.log(`Sin copiar: ${sinCopia.length} · páginas HTML pendientes: ${porClase.html.length} · informe en ${INFORME}`);
  process.exit(0);
}

if (process.argv[1]?.endsWith("copiar-archivos-viejos.ts")) main().catch((e) => { console.error(e); process.exit(1); });
