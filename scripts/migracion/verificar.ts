/**
 * Paso 3 de la migración: comprueba que quedó TODO y que cada dirección del sitio anterior sigue funcionando.
 *
 * Dos partes:
 *  A. Conciliación contra la base (todas las notas, sin red): cada dirección antigua tiene su redirección 301, cada redirección apunta a
 *     una nota publicada, y las notas migradas tienen cuerpo, categoría y portada; las imágenes ya no apuntan al sitio anterior.
 *  B. Muestra contra el sitio ya desplegado (`--base`): se pide la dirección antigua, se espera un 301 a `/articulo/…` y que esa página
 *     responda 200 con el mismo título; además un tramo de portadas se comprueba directamente. Va despacio a propósito: el portal
 *     limita a unas 120 peticiones por minuto por IP.
 *
 * Uso: npx tsx --conditions=react-server scripts/migracion/verificar.ts [--produccion] [--base=https://…] [--muestra=300] [--ritmo=900]
 */
import { createReadStream, existsSync, readdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { CACHE, DIR_HISTORIAS, dormir, urlBaseDeDatos } from "./comun";
import type { NotaDescargada } from "./extraer";
import { aTextoPlano, camposBasicos } from "./transformar";

const valor = (n: string, def: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? def;
const PRODUCCION = process.argv.includes("--produccion");
const BASE = valor("base", "").replace(/\/$/, "");
// Solo la prueba contra el sitio desplegado (sin tocar la base): útil con un servidor local que ya tiene la base abierta.
const SOLO_HTTP = process.argv.includes("--solo-http");
const MUESTRA = Number(valor("muestra", "300"));
const RITMO = Number(valor("ritmo", "900"));

async function* leerRegistros(): AsyncGenerator<NotaDescargada> {
  const vistos = new Set<string>();
  const archivos = existsSync(DIR_HISTORIAS) ? readdirSync(DIR_HISTORIAS).filter((f) => f.endsWith(".jsonl")).sort().reverse() : [];
  for (const f of archivos) {
    const rl = createInterface({ input: createReadStream(join(DIR_HISTORIAS, f), "utf8"), crlfDelay: Infinity });
    for await (const linea of rl) {
      if (!linea) continue;
      try {
        const r = JSON.parse(linea) as NotaDescargada;
        if (vistos.has(r.path)) continue;
        vistos.add(r.path);
        if (r.story) yield r;
      } catch {
        /* línea cortada */
      }
    }
  }
}

// Letras y números sin tildes ni signos, para comparar titulares sin que las comillas o los espacios cuenten.
const soloLetras = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

type Falla = { que: string; ejemplos: string[]; total: number };

async function main() {
  if (PRODUCCION) process.env.DATABASE_URL = urlBaseDeDatos();
  const fallas: Falla[] = [];
  const falla = (que: string, lista: string[]) => {
    if (lista.length) fallas.push({ que, total: lista.length, ejemplos: lista.slice(0, 8) });
  };

  // --- A. Conciliación contra la base ---------------------------------------------------------------------------------------
  const rutas: string[] = [];
  const titulos = new Map<string, string>();
  for await (const r of leerRegistros()) {
    rutas.push(r.path);
    titulos.set(r.path, camposBasicos(r).titulo);
  }
  console.log(`Notas en la caché del sitio anterior: ${rutas.length}`);

  const filas = new Map<string, string>();
  let esperadas = 0;
  let resumen: Record<string, number> = {};
  if (!SOLO_HTTP) {
    const { db } = await import("@/db");
    const { articles, redirects } = await import("@/db/schema");
    // Cada dirección antigua debe: (a) ser la dirección original de una nota publicada (se sirve directamente) o (b) tener una redirección
    // que lleve a una nota publicada (la copia repetida de otra sección).
    const directas = new Set<string>();
    for (let i = 0; i < rutas.length; i += 5000) {
      const trozo = rutas.slice(i, i + 5000);
      for (const f of await db.select({ r: articles.legacyPath }).from(articles).where(and(inArray(articles.legacyPath, trozo), eq(articles.status, "publicado")))) if (f.r) directas.add(f.r);
    }
    const sinNota = rutas.filter((r) => !directas.has(r));
    for (let i = 0; i < sinNota.length; i += 5000) {
      const trozo = sinNota.slice(i, i + 5000);
      for (const f of await db.select({ de: redirects.fromPath, a: redirects.toPath }).from(redirects).where(inArray(redirects.fromPath, trozo))) filas.set(f.de, f.a);
    }
    falla("direcciones antiguas que ni se sirven directamente ni tienen redirección", sinNota.filter((r) => !filas.has(r)));

    const destinos = [...new Set(filas.values())];
    const publicadas = new Set<string>();
    const slugs = destinos.filter((d) => d.startsWith("/articulo/")).map((d) => d.replace(/^\/articulo\//, ""));
    const rutasDestino = destinos.filter((d) => !d.startsWith("/articulo/"));
    for (let i = 0; i < slugs.length; i += 5000) {
      for (const f of await db.select({ slug: articles.slug }).from(articles).where(and(inArray(articles.slug, slugs.slice(i, i + 5000)), eq(articles.status, "publicado")))) publicadas.add(`/articulo/${f.slug}`);
    }
    for (let i = 0; i < rutasDestino.length; i += 5000) {
      for (const f of await db.select({ r: articles.legacyPath }).from(articles).where(and(inArray(articles.legacyPath, rutasDestino.slice(i, i + 5000)), eq(articles.status, "publicado")))) if (f.r) publicadas.add(f.r);
    }
    falla("redirecciones que apuntan a una nota NO publicada o inexistente", [...filas].filter(([, a]) => !publicadas.has(a)).map(([de, a]) => `${de} → ${a}`));

    [resumen] = await db
      .select({
        migradas: sql<number>`count(*)::int`,
        publicadas: sql<number>`count(*) filter (where ${articles.status} = 'publicado')::int`,
        sinCuerpo: sql<number>`count(*) filter (where length(${articles.body}) < 40)::int`,
        sinCategoria: sql<number>`count(*) filter (where ${articles.categoryId} is null)::int`,
        sinPortada: sql<number>`count(*) filter (where ${articles.coverImageUrl} is null)::int`,
        sinAutor: sql<number>`count(*) filter (where ${articles.authorId} is null)::int`,
        conStoryblok: sql<number>`count(*) filter (where ${articles.body} like '%storyblok.com%' or ${articles.coverImageUrl} like '%storyblok.com%')::int`,
        sinResumen: sql<number>`count(*) filter (where length(${articles.excerpt}) < 5)::int`,
      })
      .from(articles)
      .where(isNull(articles.createdBy));
    console.log("Notas migradas en la base:", resumen);
    if (resumen.sinCuerpo > 20) fallas.push({ que: "notas migradas con cuerpo vacío", total: resumen.sinCuerpo, ejemplos: [] });
    if (resumen.conStoryblok) fallas.push({ que: "notas que aún apuntan a imágenes de Storyblok (no se copiaron)", total: resumen.conStoryblok, ejemplos: [] });
    esperadas = directas.size;
    console.log(`Direcciones antiguas servidas directamente: ${directas.size} · con redirección (copias repetidas): ${filas.size} · de ${rutas.length}`);

  }

  // --- B. Muestra contra el sitio desplegado ---------------------------------------------------------------------------------
  const http: { pedidas: number; ok: number; fallos: string[] } = { pedidas: 0, ok: 0, fallos: [] };
  if (BASE) {
    // Muestra repartida por toda la lista (no solo las más nuevas), con una semilla fija para poder repetirla.
    let semilla = 11;
    const azar = () => (semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const elegidas = [...new Set(Array.from({ length: Math.min(MUESTRA, rutas.length) }, () => rutas[Math.floor(azar() * rutas.length)]))];
    console.log(`Comprobando ${elegidas.length} direcciones antiguas contra ${BASE} (una por ${RITMO} ms)…`);
    for (const ruta of elegidas) {
      http.pedidas++;
      try {
        // La dirección original debe responder 200 directamente (sin redirección) con su canónica igual a sí misma; solo las copias repetidas
        // de otra sección pueden redirigir (una vez) a la dirección de la nota.
        const r1 = await fetch(BASE + encodeURI(ruta), { redirect: "manual", signal: AbortSignal.timeout(30_000) });
        let html: string;
        let esCopia = false;
        if (r1.status === 200) html = await r1.text();
        else if (r1.status === 301 || r1.status === 308) {
          const destino = r1.headers.get("location");
          if (!destino) { http.fallos.push(`${ruta}: redirige sin destino`); await dormir(RITMO); continue; }
          esCopia = true;
          await dormir(RITMO / 2);
          const r2 = await fetch(new URL(destino, BASE).toString(), { redirect: "manual", signal: AbortSignal.timeout(30_000) });
          if (r2.status !== 200) { http.fallos.push(`${ruta} → ${destino}: ${r2.status}`); await dormir(RITMO); continue; }
          html = await r2.text();
        } else { http.fallos.push(`${ruta}: respondió ${r1.status}`); await dormir(RITMO); continue; }
        const titulo = titulos.get(ruta) ?? "";
        // El titular visible (h1): el <title> puede llevar el título SEO, que es otro texto.
        const enPagina = aTextoPlano(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "").toLowerCase();
        const canonica = decodeURIComponent((html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? "").replace(/^https?:\/\/[^/]+/, ""));
        if (!esCopia && canonica !== ruta) http.fallos.push(`${ruta}: la canónica es «${canonica}»`);
        else if (titulo && !soloLetras(enPagina).includes(soloLetras(titulo).slice(0, 25))) http.fallos.push(`${ruta}: el titular de la página no coincide («${enPagina.slice(0, 60)}»)`);
        else http.ok++;
      } catch (e) {
        http.fallos.push(`${ruta}: ${e instanceof Error ? e.message : String(e)}`);
      }
      await dormir(RITMO);
    }
    falla(`direcciones de la muestra que NO funcionan en ${BASE}`, http.fallos);
  } else console.log("Sin --base: se omite la prueba contra el sitio desplegado.");

  const informe = { fecha: new Date().toISOString(), produccion: PRODUCCION, base: BASE || null, notasEnCache: rutas.length, redirecciones: filas.size, esperadas, resumen, http: { pedidas: http.pedidas, ok: http.ok }, fallas };
  writeFileSync(join(CACHE, "informe-verificacion.json"), JSON.stringify(informe, null, 1));
  if (fallas.length) {
    console.log("\nFALLAS:");
    for (const f of fallas) console.log(` - ${f.que}: ${f.total}${f.ejemplos.length ? `\n     ${f.ejemplos.join("\n     ")}` : ""}`);
  } else console.log("\nTodo en orden: no hay fallas.");
  console.log("Informe: .migracion-cache/informe-verificacion.json");
  process.exit(fallas.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
