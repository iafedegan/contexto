/**
 * Repara las imágenes que la migración no pudo copiar: las que siguen apuntando a `a.storyblok.com` dentro del texto de las notas
 * (`src` y `href`) y las notas sin portada cuyo sitio anterior sí mostraba una (se lee su `og:image`; el logo no cuenta).
 *
 * Por defecto NO escribe: cuenta lo pendiente y comprueba si Storyblok ya entrega las imágenes (hoy responde 403: límite de uso del
 * plan). Con `--aplicar` copia cada imagen al bucket «media» y reescribe la nota. Es idempotente: se puede repetir.
 *
 * Uso: npx tsx --conditions=react-server scripts/migracion/reparar-imagenes.ts [--produccion] [--aplicar] [--portadas] [--limite=50]
 * Necesita las credenciales de Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY, o `.env.migracion`) y DATABASE_URL con --produccion.
 */
import { eq, sql } from "drizzle-orm";
import { pedir, urlBaseDeDatos } from "./comun";
import { CopiadorDeImagenes } from "./imagenes";
import { decodificarEntidades, urlBaseImagen } from "./transformar";

const bandera = (n: string) => process.argv.includes(`--${n}`);
const valor = (n: string, def: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? def;
const APLICAR = bandera("aplicar");
const PORTADAS = bandera("portadas");
const LIMITE = Number(valor("limite", "100000"));

const EN_STORYBLOK = /\b(src|href)="((?:https?:)?\/{2,3}a\.storyblok\.com\/[^"]+)"/gi;

/** Reemplaza cada dirección de Storyblok del HTML por la copia propia. Devuelve el HTML nuevo y cuántas cambió. */
export async function reescribirCuerpo(html: string, copiar: (url: string) => Promise<string | null>): Promise<{ html: string; cambios: number }> {
  const direcciones = new Set<string>();
  for (const m of html.matchAll(EN_STORYBLOK)) direcciones.add(m[2]);
  let salida = html;
  let cambios = 0;
  for (const original of direcciones) {
    const base = urlBaseImagen(decodificarEntidades(original));
    if (!/\.(?:jpe?g|png|webp|gif)$/i.test(base)) continue;
    const nueva = await copiar(base);
    if (!nueva) continue;
    salida = salida.split(`"${original}"`).join(`"${nueva}"`);
    cambios++;
  }
  return { html: salida, cambios };
}

async function main() {
  if (bandera("produccion")) process.env.DATABASE_URL = urlBaseDeDatos();
  const { db } = await import("@/db");
  const { articles } = await import("@/db/schema");
  const copiador = APLICAR ? new CopiadorDeImagenes(4) : null;
  if (copiador) console.log(`Intentos fallidos anteriores olvidados: ${copiador.olvidarFallidas()}`);

  // La tabla es grande y la expresión regular recorre cada cuerpo: una sola consulta pasa del tiempo máximo de la conexión. Se lee por rangos de
  // `id` (256 tandas por el primer byte del uuid; cada una usa el índice de la llave primaria y trae unas 200 filas).
  const rangos = Array.from({ length: 256 }, (_, i) => {
    const h = (n: number) => n.toString(16).padStart(2, "0");
    return { desde: `${h(i)}000000-0000-0000-0000-000000000000`, hasta: i < 255 ? `${h(i + 1)}000000-0000-0000-0000-000000000000` : null };
  });
  const enRango = (r: { desde: string; hasta: string | null }) => (r.hasta ? sql`${articles.id} >= ${r.desde}::uuid and ${articles.id} < ${r.hasta}::uuid` : sql`${articles.id} >= ${r.desde}::uuid`);

  const notas: { id: string; legacy: string | null; body: string }[] = [];
  for (const r of rangos) {
    if (notas.length >= LIMITE) break;
    notas.push(
      ...(await db
        .select({ id: articles.id, legacy: articles.legacyPath, body: articles.body })
        .from(articles)
        .where(sql`${enRango(r)} and ${articles.body} ~ '(src|href)="(https?:)?/{2,3}a\\.storyblok\\.com'`)
        .limit(LIMITE - notas.length)),
    );
  }
  console.log(`Notas con imágenes aún en Storyblok: ${notas.length}`);

  // Sondeo: ¿Storyblok entrega hoy alguna?
  const muestra = notas.flatMap((n) => [...n.body.matchAll(EN_STORYBLOK)].map((m) => urlBaseImagen(decodificarEntidades(m[2])))).slice(0, 5);
  for (const u of muestra) {
    const r = await pedir(u, { intentos: 1, timeoutMs: 20_000 }).catch(() => null);
    console.log(`  sondeo ${r ? r.status : "sin respuesta"}  ${u}`);
  }
  if (!copiador) {
    console.log("Simulacro: no se escribió nada. Repite con --aplicar cuando el sondeo dé 200.");
    process.exit(0);
  }

  let reparadas = 0;
  for (const n of notas) {
    const { html, cambios } = await reescribirCuerpo(n.body, (u) => copiador.copiar(u));
    if (!cambios) continue;
    await db.update(articles).set({ body: html }).where(eq(articles.id, n.id));
    reparadas++;
    if (reparadas % 25 === 0) console.log(`  ${reparadas} notas reparadas…`);
  }
  console.log(`Notas reparadas: ${reparadas} de ${notas.length} · ${JSON.stringify(copiador.estadisticas)}`);

  if (PORTADAS) {
    const sinPortada: { id: string; legacy: string | null }[] = [];
    for (const r of rangos) {
      if (sinPortada.length >= LIMITE) break;
      sinPortada.push(
        ...(await db
          .select({ id: articles.id, legacy: articles.legacyPath })
          .from(articles)
          .where(sql`${enRango(r)} and ${articles.legacyPath} is not null and (${articles.coverImageUrl} is null or ${articles.coverImageUrl} = '') and ${articles.legacyPath} not like '/columna/%'`)
          .limit(LIMITE - sinPortada.length)),
      );
    }
    let puestas = 0;
    for (const n of sinPortada) {
      const pagina = await pedir(`https://www.contextoganadero.com${n.legacy}`, { intentos: 2 }).then((r) => (r.ok ? r.text() : "")).catch(() => "");
      const og = pagina.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1];
      if (!og || /logo_cg/i.test(og)) continue;
      const copia = await copiador.copiar(urlBaseImagen(decodificarEntidades(og)));
      if (!copia) continue;
      await db.update(articles).set({ coverImageUrl: copia }).where(eq(articles.id, n.id));
      puestas++;
    }
    console.log(`Portadas recuperadas: ${puestas} de ${sinPortada.length}`);
  }
  process.exit(0);
}

if (process.argv[1]?.endsWith("reparar-imagenes.ts")) main().catch((e) => { console.error(e); process.exit(1); });
