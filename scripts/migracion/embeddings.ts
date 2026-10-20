/**
 * Genera los embeddings (pgvector, 1536 dims; Gemini por defecto) de las notas publicadas que aún no tienen. Reanudable: solo toma las que siguen en NULL, en
 * lotes pequeños por rango de `id` (un conteo global expira en la base de producción), y se detiene sola al llegar al tope de gasto.
 *
 * Por defecto NO escribe: estima tokens y costo de las primeras notas pendientes. Con `--aplicar` escribe.
 *
 * Uso: GOOGLE_GENERATIVE_AI_API_KEY=… npx tsx --conditions=react-server --tsconfig tsconfig.json scripts/migracion/embeddings.ts [--produccion] [--aplicar] [--limite=200] [--tope-usd=10]
 * Necesita la clave de Google (variable de entorno o `.env.migracion`, nunca en el repositorio) y DATABASE_URL (o `.env.migracion`) con --produccion.
 */
import { sql } from "drizzle-orm";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { urlBaseDeDatos } from "./comun";

/** La clave de Google se toma del entorno o, si falta, de `.env.migracion` (GOOGLE_GENERATIVE_AI_API_KEY o GOOGLE_API_KEY). Nunca se imprime. */
function cargarClaveGoogle(): void {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.EMBEDDING_PROVIDER === "openai") return;
  const f = join(process.cwd(), ".env.migracion");
  if (!existsSync(f)) return;
  const m = readFileSync(f, "utf8").match(/^(?:GOOGLE_GENERATIVE_AI_API_KEY|GOOGLE_API_KEY)=(\S+)/m);
  if (m) process.env.GOOGLE_GENERATIVE_AI_API_KEY = m[1];
}

const bandera = (n: string) => process.argv.includes(`--${n}`);
const valor = (n: string, def: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? def;
const APLICAR = bandera("aplicar");
const LIMITE = Number(valor("limite", "100000"));
const TOPE_USD = Number(valor("tope-usd", "10"));
const LOTE = 32; // textos por petición a OpenAI (igual que EMBEDDINGS_POR_PETICION)
const USD_POR_MILLON = 0.15; // gemini-embedding-001 (tarifa de referencia, verificar la vigente)
const TOKENS_POR_CARACTER = 0.3; // estimación para español

const texto = (a: { title: string; excerpt: string; body: string }) => `${a.title}. ${a.excerpt}. ${a.body.replace(/<[^>]+>/g, " ")}`;

async function main() {
  if (bandera("produccion")) process.env.DATABASE_URL = urlBaseDeDatos();
  cargarClaveGoogle();
  if (APLICAR && !(process.env.EMBEDDING_PROVIDER === "openai" ? process.env.OPENAI_API_KEY : process.env.GOOGLE_GENERATIVE_AI_API_KEY)) throw new Error("Falta la clave de Google (GOOGLE_GENERATIVE_AI_API_KEY) en el entorno o en .env.migracion.");
  const { db } = await import("@/db");
  const { embedMany, toVectorLiteral } = await import("@/lib/embeddings");
  const rows = <T>(r: unknown): T[] => (Array.isArray(r) ? r : ((r as { rows?: T[] }).rows ?? [])) as T[];

  let hechas = 0, tokens = 0, falladas = 0, cursor = "00000000-0000-0000-0000-000000000000";
  while (hechas < LIMITE) {
    const n = Math.min(LOTE, LIMITE - hechas);
    // Solo notas publicadas sin vector, por orden de id: reanuda donde quedó y no recorre toda la tabla.
    const lote = rows<{ id: string; title: string; excerpt: string; body: string }>(
      await db.execute(sql`select id, title, coalesce(excerpt,'') as excerpt, left(coalesce(body,''), 8000) as body from articles
        where id > ${cursor}::uuid and status = 'publicado' and embedding is null order by id limit ${n}`),
    );
    if (!lote.length) break;
    cursor = lote[lote.length - 1].id;
    const textos = lote.map(texto).map((t) => t.replace(/\s+/g, " ").trim().slice(0, 8000));
    tokens += textos.reduce((s, t) => s + t.length * TOKENS_POR_CARACTER, 0);
    const usd = (tokens / 1e6) * USD_POR_MILLON;
    if (usd > TOPE_USD) { console.log(`Tope de gasto alcanzado (US$${usd.toFixed(2)}). Se detiene; se puede reanudar.`); break; }
    if (APLICAR) {
      const vectores = await embedMany(textos);
      for (const [i, v] of vectores.entries()) {
        if (!v) { falladas++; continue; }
        await db.execute(sql`update articles set embedding = ${toVectorLiteral(v)}::vector where id = ${lote[i].id}::uuid and embedding is null`);
      }
    }
    hechas += lote.length;
    if (hechas % 320 === 0 || lote.length < n) console.log(`${hechas} notas · ~${Math.round(tokens / 1000)}k tokens · ~US$${usd.toFixed(3)} · fallidas ${falladas}`);
  }
  console.log(`${APLICAR ? "Listo" : "Simulación"}: ${hechas} notas, ~${Math.round(tokens / 1000)}k tokens, ~US$${((tokens / 1e6) * USD_POR_MILLON).toFixed(3)}, fallidas ${falladas}.`);
  process.exit(0);
}
main().catch((e) => { console.error((e as Error).message); process.exit(1); });
