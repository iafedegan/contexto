/**
 * Copia las imágenes del almacenamiento de Supabase (bucket `media`) a una carpeta local o a un disco externo. Las copias
 * automáticas de la base de datos NO incluyen los archivos del almacenamiento: este script cubre esa brecha.
 *
 * Solo LEE de Supabase (listar y descargar); nunca borra ni modifica nada allá. Es incremental: salta lo que ya está en el destino
 * con el mismo tamaño, así que se puede repetir (por ejemplo cada semana) o retomar si se corta.
 *
 * Uso: npx tsx scripts/respaldo-imagenes.ts --simulacro                      (cuenta archivos y peso, no descarga)
 *      npx tsx scripts/respaldo-imagenes.ts --destino=/Volumes/Disco/respaldo-media [--paralelo=6]
 * Necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (variables de entorno o un `.env.migracion` que las traiga).
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { credencialesStorage } from "./migracion/comun";

const BUCKET = "media";
const bandera = (n: string) => process.argv.includes(`--${n}`);
const valor = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");

type Objeto = { ruta: string; bytes: number; actualizado: string | null };

const { url, key } = credencialesStorage();
const auth = { Authorization: `Bearer ${key}`, apikey: key };

/** Lista una carpeta del bucket (los elementos sin `id` son subcarpetas). */
async function listar(prefijo: string): Promise<{ archivos: Objeto[]; carpetas: string[] }> {
  const archivos: Objeto[] = [];
  const carpetas: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: prefijo, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) throw new Error(`No se pudo listar «${prefijo}»: HTTP ${r.status}`);
    const filas = (await r.json()) as { name: string; id: string | null; updated_at?: string; metadata?: { size?: number } | null }[];
    for (const f of filas) {
      const ruta = prefijo ? `${prefijo}/${f.name}` : f.name;
      if (f.id === null) carpetas.push(ruta);
      else archivos.push({ ruta, bytes: Number(f.metadata?.size ?? 0), actualizado: f.updated_at ?? null });
    }
    if (filas.length < 1000) break;
  }
  return { archivos, carpetas };
}

/** Recorre todo el bucket. */
async function inventario(): Promise<Objeto[]> {
  const todos: Objeto[] = [];
  const pendientes = [""];
  while (pendientes.length) {
    const { archivos, carpetas } = await listar(pendientes.pop()!);
    todos.push(...archivos);
    pendientes.push(...carpetas);
    process.stdout.write(`\r  ${todos.length} archivos listados…`);
  }
  process.stdout.write("\n");
  return todos;
}

const mb = (b: number) => `${(b / 1_048_576).toFixed(1)} MB`;

async function main() {
  console.log(`Bucket «${BUCKET}» de ${url.replace(/^https:\/\//, "")}`);
  const objetos = await inventario();
  const total = objetos.reduce((a, o) => a + o.bytes, 0);
  console.log(`Total: ${objetos.length} archivos, ${mb(total)} (${(total / 1_073_741_824).toFixed(2)} GB).`);

  const destino = valor("destino");
  if (bandera("simulacro") || !destino) {
    console.log(destino ? "Simulacro: no se descargó nada." : "Falta --destino=<carpeta>: solo se contó. Repite con --destino para copiar.");
    return;
  }

  const raiz = resolve(destino);
  mkdirSync(raiz, { recursive: true });
  const paralelo = Math.max(1, Math.min(12, Number(valor("paralelo") ?? 6)));
  const cola = objetos.filter((o) => {
    const f = join(raiz, o.ruta);
    return !(existsSync(f) && statSync(f).size === o.bytes && o.bytes > 0);
  });
  console.log(`Por copiar: ${cola.length} (ya estaban ${objetos.length - cola.length}). Destino: ${raiz}`);

  let hechos = 0;
  const fallidos: string[] = [];
  const trabajador = async () => {
    for (let o = cola.pop(); o; o = cola.pop()) {
      try {
        const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${o.ruta.split("/").map(encodeURIComponent).join("/")}`, { headers: auth, signal: AbortSignal.timeout(120_000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const bytes = Buffer.from(await r.arrayBuffer());
        if (o.bytes && bytes.length !== o.bytes) throw new Error(`tamaño ${bytes.length} ≠ ${o.bytes}`);
        const f = join(raiz, o.ruta);
        mkdirSync(dirname(f), { recursive: true });
        await writeFile(f, bytes);
        hechos++;
        if (hechos % 100 === 0) process.stdout.write(`\r  ${hechos} copiados…`);
      } catch (e) {
        fallidos.push(`${o.ruta}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: paralelo }, trabajador));
  process.stdout.write("\n");

  writeFileSync(join(raiz, "manifiesto.json"), JSON.stringify({ generado: new Date().toISOString(), bucket: BUCKET, archivos: objetos.length, bytes: total, objetos }, null, 1));
  console.log(`Copiados ahora: ${hechos} · fallidos: ${fallidos.length}. Manifiesto: ${join(raiz, "manifiesto.json")}`);
  if (fallidos.length) {
    console.error(fallidos.slice(0, 20).join("\n"));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
