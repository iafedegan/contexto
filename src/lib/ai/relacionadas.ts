import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { getAiModel } from "@/lib/ai-provider";
import { registrarUsoIA, verificarCuotaIA } from "@/lib/ai-cuota";
import { hybridSearch } from "@/lib/search";
import { stripHtml } from "@/lib/sanitize";
import type { NotaRelacionada } from "@/lib/ai/relacionadas-html";

export type RelacionadasResult =
  | { ok: true; notas: NotaRelacionada[]; /** Quién decidió que hablan de lo mismo: el modelo o, sin modelo, las palabras que comparten. */ criterio: "ia" | "palabras" }
  | { ok: false; error: string };

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

// Palabras tan generales en este medio que compartirlas no dice nada del asunto de la nota.
const GENERICAS = new Set(["ganaderia", "ganadero", "ganaderos", "ganaderas", "colombia", "colombiano", "colombiana", "sector", "productor", "productores", "campo", "gobierno", "nacional", "pequenos", "pequeno", "regional", "ganado", "produccion", "nuevo", "nueva", "nuevos", "nuevas", "busca", "frente", "entre", "sobre", "ademas", "desde", "tras"]);

// Palabras con contenido (5 letras o más, no generales) de un texto, sin tildes.
const palabras = (s: string) => new Set(norm(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 5 && !GENERICAS.has(w)));

// Sin modelo: una nota «habla de lo mismo» si comparte al menos tres palabras con contenido con el título y el resumen de la nota.
function porPalabras(nota: string, candidatas: NotaRelacionada[], limite: number): NotaRelacionada[] {
  const mias = palabras(nota);
  return candidatas
    .filter((c) => [...palabras(`${c.title} ${c.summary}`)].filter((w) => mias.has(w)).length >= 3)
    .slice(0, limite);
}

const juezSchema = z.object({
  elegidas: z.array(z.object({ n: z.number().int(), motivo: z.string().max(200) })).max(5),
});

/**
 * Busca, SOLO entre las notas de CONtexto Ganadero (las publicadas del sitio y su archivo histórico), las que tratan lo mismo que la
 * nota que se está escribiendo. La búsqueda trae candidatas y el modelo descarta las que solo comparten sector o palabras: queda
 * únicamente la que un lector querría seguir leyendo sobre ese mismo asunto. Nunca inventa una nota ni un enlace: todo sale de la base.
 */
export async function buscarRelacionadasCore(
  userId: string,
  input: { title: string; excerpt?: string; body: string; /** Id de la nota que se escribe, para no enlazarla consigo misma. */ excluirId?: string; limite?: number },
): Promise<RelacionadasResult> {
  const titulo = input.title.trim();
  if (titulo.length < 5) return { ok: false, error: "Escribe antes el título de la nota." };
  const limite = Math.min(5, Math.max(1, input.limite ?? 3));
  const cuerpo = stripHtml(input.body.replace(/\[\[GRAFICA[^\]]*\]\]/g, " ").replace(/<details[\s\S]*?<\/details>/gi, " ")).replace(/\s+/g, " ").trim();
  const resumen = (input.excerpt ?? "").trim();
  const nota = [titulo, resumen, cuerpo.slice(0, 400)].filter(Boolean).join(". ");

  let candidatas: NotaRelacionada[];
  try {
    const hits = await hybridSearch(nota, 14);
    const propio = norm(titulo);
    const vistos = new Set<string>();
    candidatas = hits
      .filter((h) => !(h.kind === "articulo" && h.id === input.excluirId) && norm(h.title) !== propio && h.publishedAt)
      .filter((h) => (vistos.has(h.url) ? false : (vistos.add(h.url), true)))
      .map((h) => ({ kind: h.kind, id: h.id, title: h.title.trim(), summary: h.summary.trim(), url: h.url, publishedAt: h.publishedAt }));
  } catch (e) {
    console.error("buscarRelacionadas:", e);
    return { ok: false, error: "No se pudo consultar el archivo de notas. Inténtalo de nuevo en un momento." };
  }
  if (!candidatas.length) return { ok: true, notas: [], criterio: "palabras" };

  const model = await getAiModel();
  if (!model) return { ok: true, notas: porPalabras(nota, candidatas, limite), criterio: "palabras" };
  try {
    const cuota = await verificarCuotaIA(userId);
    if (!cuota.ok) return { ok: true, notas: porPalabras(nota, candidatas, limite), criterio: "palabras" };
    const { object, usage } = await generateObject({
      model,
      schema: juezSchema,
      system:
        "Eres editor de un medio agropecuario colombiano. Decides qué notas ya publicadas conviene enlazar al final de otra nota. Solo cuentan las que tratan el MISMO asunto concreto (el mismo hecho, programa, acuerdo, enfermedad, cifra o tema específico) y que un lector querría seguir leyendo a continuación. Compartir el sector, la palabra «ganadería» o un tema muy amplio NO basta. Ante la duda, no la elijas: es mejor no enlazar nada que enlazar algo que no viene al caso.",
      prompt: `NOTA QUE SE ESCRIBE:\n${nota.slice(0, 1200)}\n\nNOTAS CANDIDATAS:\n${candidatas
        .map((c, i) => `[${i + 1}] ${c.title} — ${c.summary.slice(0, 260)}`)
        .join("\n")}\n\nDevuelve las candidatas (hasta ${limite}, las más pertinentes primero) que tratan lo mismo, con el motivo en una frase. Si ninguna, devuelve la lista vacía.`,
    });
    await registrarUsoIA(userId, usage);
    const vistas = new Set<number>();
    const notas = object.elegidas
      .map((e) => e.n)
      .filter((n) => n >= 1 && n <= candidatas.length && (vistas.has(n) ? false : (vistas.add(n), true)))
      .slice(0, limite)
      .map((n) => candidatas[n - 1]);
    return { ok: true, notas, criterio: "ia" };
  } catch (e) {
    console.error("buscarRelacionadas (modelo):", e);
    return { ok: true, notas: porPalabras(nota, candidatas, limite), criterio: "palabras" };
  }
}
