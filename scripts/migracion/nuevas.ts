/**
 * Lista las notas del sitio anterior que todavía no están en `articles` (comparando su mapa del sitio con `legacy_path`) y las guarda en
 * `.migracion-cache/urls-nuevas.txt`. Solo lee. Después: `descargar.ts --solo=urls-nuevas.txt` y `cargar.ts --produccion`.
 *
 * Uso: npx tsx --conditions=react-server scripts/migracion/nuevas.ts [--produccion]
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE, SITIO_ANTIGUO, pedir, prepararCache, urlBaseDeDatos } from "./comun";
import { direccionesDeMapa } from "./extraer";

async function main() {
  prepararCache();
  if (process.argv.includes("--produccion")) process.env.DATABASE_URL = urlBaseDeDatos();
  const { db } = await import("@/db");
  const { articles } = await import("@/db/schema");

  const enSitio: string[] = [];
  const indice = await (await pedir(`${SITIO_ANTIGUO}/sitemap.xml`)).text();
  for (const m of direccionesDeMapa(indice)) enSitio.push(...direccionesDeMapa(await (await pedir(m)).text()));
  const rutas = new Map<string, string>();
  for (const u of enSitio) {
    const ruta = decodeURIComponent(new URL(u).pathname);
    if (ruta !== "/" && ruta.split("/").filter(Boolean).length === 2) rutas.set(ruta, u);
  }

  // El mapa del sitio va retrasado: lo publicado en los últimos días solo se ve en la portada y en las páginas de sección. Se rastrean esas.
  const secciones = new Set([...rutas.keys()].map((r) => r.split("/")[1]));
  for (const pagina of ["", ...[...secciones].map((x) => `/${x}`)]) {
    const html = await pedir(`${SITIO_ANTIGUO}${pagina}`).then((r) => r.text()).catch(() => "");
    for (const m of html.matchAll(/(?:^|["'\/])((?:[a-z0-9-]+)\/[a-z0-9-]{20,})(?=["'?#\\])/g)) {
      const ruta = `/${m[1]}`;
      if (secciones.has(m[1].split("/")[0]) && !rutas.has(ruta)) rutas.set(ruta, `${SITIO_ANTIGUO}${ruta}`);
    }
  }

  const propias = new Set<string>();
  for (const f of await db.select({ p: articles.legacyPath }).from(articles)) if (f.p) propias.add(decodeURIComponent(f.p));
  const nuevas = [...rutas].filter(([r]) => !propias.has(r)).map(([, u]) => u);
  writeFileSync(join(CACHE, "urls-nuevas.txt"), nuevas.join("\n") + (nuevas.length ? "\n" : ""));
  console.log(`En el sitio anterior: ${rutas.size} · ya en la base: ${propias.size} · nuevas: ${nuevas.length}`);
  console.log(nuevas.slice(0, 15).join("\n"));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
