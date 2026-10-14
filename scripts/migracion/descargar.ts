/**
 * Paso 1 de la migración: descarga del sitio anterior TODAS las notas de su mapa del sitio y guarda, de cada una, el contenido completo
 * (JSON de Next.js) en la caché local `.migracion-cache/historias/*.jsonl`. Es reanudable (si se corta, sigue donde iba) y se puede
 * repetir cuando se quiera para traer solo lo publicado en el sitio viejo desde la última vez (hasta el día del cambio). Solo lee del sitio anterior; no escribe nada en ninguna parte salvo la caché local.
 *
 * Uso: npx tsx scripts/migracion/descargar.ts [--concurrencia=10] [--limite=N] [--refrescar=N]
 */
import { appendFileSync, createReadStream, existsSync, readdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { CACHE, DIR_HISTORIAS, SITIO_ANTIGUO, pedir, prepararCache } from "./comun";
import { direccionesDeMapa, extraerNota } from "./extraer";

const arg = (n: string, def: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? def;
const CONCURRENCIA = Number(arg("concurrencia", "10"));
const LIMITE = Number(arg("limite", "0"));
// Vuelve a pedir las N notas más recientes del mapa (las que pudieron editarse desde la última descarga), aunque ya estén en la caché.
const REFRESCAR = Number(arg("refrescar", "0"));

prepararCache();

// 1. Mapa del sitio: índice → mapas → direcciones de notas.
async function direcciones(): Promise<string[]> {
  const indice = await (await pedir(`${SITIO_ANTIGUO}/sitemap.xml`)).text();
  const mapas = direccionesDeMapa(indice);
  const todas: string[] = [];
  for (const m of mapas) {
    const urls = direccionesDeMapa(await (await pedir(m)).text());
    todas.push(...urls);
    console.log(`mapa ${m.split("/").pop()}: ${urls.length}`);
  }
  const vistas = new Set<string>();
  return todas.filter((u) => {
    const ruta = new URL(u).pathname;
    if (ruta === "/" || ruta.split("/").filter(Boolean).length !== 2 || vistas.has(ruta)) return false;
    vistas.add(ruta);
    return true;
  });
}

// 2. Qué ya se descargó (para reanudar). Se lee línea a línea: los archivos pueden pesar cientos de MB.
async function yaHechas(): Promise<Set<string>> {
  const hechas = new Set<string>();
  if (!existsSync(DIR_HISTORIAS)) return hechas;
  for (const f of readdirSync(DIR_HISTORIAS).filter((x) => x.endsWith(".jsonl"))) {
    const rl = createInterface({ input: createReadStream(join(DIR_HISTORIAS, f), "utf8"), crlfDelay: Infinity });
    for await (const linea of rl) {
      if (!linea) continue;
      try {
        const r = JSON.parse(linea) as { path: string; status: number; story: unknown };
        if (r.story || r.status === 404) hechas.add(r.path);
      } catch {
        /* línea cortada por una interrupción: se vuelve a pedir */
      }
    }
  }
  return hechas;
}

async function main() {
  const urls = await direcciones();
  writeFileSync(join(CACHE, "urls.txt"), urls.join("\n") + "\n");
  console.log(`Notas en el mapa del sitio: ${urls.length}`);

  const hechas = await yaHechas();
  const rutaDe = (u: string) => decodeURIComponent(new URL(u).pathname);
  const recientes = new Set(urls.slice(0, REFRESCAR));
  let pendientes = urls.filter((u) => recientes.has(u) || !hechas.has(rutaDe(u)));
  if (LIMITE > 0) pendientes = pendientes.slice(0, LIMITE);
  console.log(`Ya descargadas: ${hechas.size} · por descargar: ${pendientes.length} · concurrencia ${CONCURRENCIA}`);

  // Archivos de 2.000 notas como máximo, para que ninguno crezca sin medida (los nombres crecen con el tiempo: la carga lee primero los más nuevos).
  const inicio = Date.now();
  let archivo = join(DIR_HISTORIAS, `h-${inicio}-0.jsonl`);
  let enArchivo = 0;
  let numeroArchivo = 0;
  let i = 0;
  let ok = 0;
  let sinNota = 0;
  let fallos = 0;
  const t0 = Date.now();

  async function trabajador() {
    while (i < pendientes.length) {
      const url = pendientes[i++];
      const ruta = decodeURIComponent(new URL(url).pathname);
      try {
        const r = await pedir(url);
        const html = await r.text();
        const registro = extraerNota(html, ruta, r.status);
        if (++enArchivo > 2000) {
          enArchivo = 1;
          archivo = join(DIR_HISTORIAS, `h-${inicio}-${String(++numeroArchivo).padStart(4, "0")}.jsonl`);
        }
        appendFileSync(archivo, JSON.stringify(registro) + "\n");
        if (registro.story) ok++;
        else sinNota++;
      } catch (e) {
        fallos++;
        appendFileSync(join(CACHE, "fallos.log"), `${ruta}\t${e instanceof Error ? e.message : String(e)}\n`);
      }
      const hecho = ok + sinNota + fallos;
      if (hecho % 250 === 0) {
        const seg = (Date.now() - t0) / 1000;
        console.log(`${hecho}/${pendientes.length} · ok ${ok} · sin nota ${sinNota} · fallos ${fallos} · ${(hecho / seg).toFixed(1)}/s · faltan ~${Math.round((pendientes.length - hecho) / (hecho / seg) / 60)} min`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));
  console.log(`Terminado. ok ${ok} · sin nota ${sinNota} · fallos ${fallos}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
