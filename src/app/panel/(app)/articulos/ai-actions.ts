"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { EDITOR_ASSIST_SYSTEM } from "@/agents/prompts";
import { focusTerms } from "@/lib/seo-audit";
import { getAiModel } from "@/lib/ai-provider";


const draftSchema = z.object({
  title: z.string().min(8),
  excerpt: z.string().min(20),
  body: z.string().min(50),
  metaTitle: z.string().min(8).max(70),
  metaDescription: z.string().min(50).max(170),
  tags: z.array(z.string()).min(2).max(8),
  keywords: z.array(z.string()).min(3).max(8),
  seoOptions: z
    .array(
      z.object({
        metaTitle: z.string(),
        metaDescription: z.string(),
        rationale: z.string(),
      }),
    )
    .min(1)
    .max(3),
});

export type GeneratedDraft = z.infer<typeof draftSchema>;

export type GenerateResult =
  | { ok: true; mode: "ia" | "esquema"; draft: GeneratedDraft; note?: string }
  | { ok: false; error: string };

/**
 * Redacta un borrador a partir del tema y las notas del periodista.
 *
 * Nunca publica: devuelve el texto al editor, que lo revisa y guarda. Es la
 * regla de la casa (AGENTS.md) y también la razón de que todo dato no
 * confirmado salga marcado entre {{llaves}} en lugar de inventado.
 *
 * Sin `ANTHROPIC_API_KEY` no se simula una noticia —sería inventar hechos—:
 * se devuelve un ESQUEMA de trabajo con la estructura, los intertítulos y la
 * ficha de posicionamiento, para que el periodista escriba encima.
 */
export async function generateArticleDraft(input: {
  title: string;
  prompt: string;
  section?: string;
}): Promise<GenerateResult> {
  await requireRole("redactor");

  const tema = input.title.trim();
  const encargo = input.prompt.trim();
  if (encargo.length < 20) {
    return { ok: false, error: "Describe el tema con un poco más de detalle (mínimo 20 caracteres)." };
  }

  const model = await getAiModel();
  if (!model) {
    return {
      ok: true,
      mode: "esquema",
      note:
        "Sin clave del modelo: no se redacta la noticia (sería inventar hechos). " +
        "Puedes añadirla en Configuración → Asistente. " +
        "Este es el esqueleto con su ficha de posicionamiento para que escribas encima.",
      draft: scaffold(tema, encargo, input.section),
    };
  }

  try {
    const { object } = await generateObject({
      model,
      schema: draftSchema,
      system: EDITOR_ASSIST_SYSTEM,
      prompt: [
        tema ? `TÍTULO PROPUESTO POR EL PERIODISTA: ${tema}` : "El periodista no fijó título.",
        input.section ? `SECCIÓN: ${input.section}` : "",
        `ENCARGO Y NOTAS:\n${encargo}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    return { ok: true, mode: "ia", draft: object };
  } catch (err) {
    console.error("generateArticleDraft:", err);
    // El mensaje del proveedor dice exactamente qué pasa («este modelo ya no
    // está disponible», «cuota agotada»…). Repetir un genérico obliga a ir a
    // los logs del servidor para algo que el editor puede resolver solo.
    const detalle =
      err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return {
      ok: false,
      error: detalle
        ? `El proveedor rechazó la petición: ${detalle.slice(0, 220)}`
        : "El modelo no respondió. Revisa la clave o inténtalo de nuevo en un momento.",
    };
  }
}

/** Esqueleto determinista: estructura y ficha, sin hechos inventados. */
function scaffold(tema: string, encargo: string, section?: string): GeneratedDraft {
  const terms = focusTerms(`${tema} ${encargo}`);
  const titulo = tema || `{{Titular}} sobre ${terms.slice(0, 3).join(", ") || "el tema"}`;
  const clave = terms.slice(0, 3).join(", ");

  return {
    title: titulo,
    excerpt: `{{Entradilla}}: qué pasó, dónde y por qué le importa al productor. Tema del encargo: ${encargo.slice(0, 120)}`,
    body: [
      `<p>{{Párrafo de apertura: el hecho principal con su cifra o fecha verificada.}}</p>`,
      `<h2>Qué dice la fuente</h2>`,
      `<p>{{Dato concreto y atribución: quién lo informó y cuándo.}}</p>`,
      `<h2>Qué significa para el productor</h2>`,
      `<p>{{Consecuencia práctica: costos, precios, sanidad o acceso a mercado.}}</p>`,
      `<h2>Qué sigue</h2>`,
      `<p>{{Próximo hito verificable: fecha, decisión pendiente o cifra esperada.}}</p>`,
    ].join("\n"),
    metaTitle: titulo.slice(0, 65),
    metaDescription: `{{Descripción}} en prosa de 70 a 155 caracteres sobre ${clave || "el tema"}.`,
    tags: terms.slice(0, 4),
    keywords: terms,
    seoOptions: [
      {
        metaTitle: titulo.slice(0, 65),
        metaDescription: `{{Qué pasó}} y qué cambia para el ganadero${section ? ` en ${section.toLowerCase()}` : ""}.`,
        rationale: "Enfoque informativo: responde la búsqueda directa del hecho.",
      },
      {
        metaTitle: `${clave || "Tema"}: {{cifra}} y qué implica`.slice(0, 65),
        metaDescription: `{{Dato concreto}} con contexto de mercado y fuente atribuida.`,
        rationale: "Enfoque de dato: capta a quien busca la cifra exacta.",
      },
      {
        metaTitle: `Lo que el alza de ${clave || "precios"} deja al productor`.slice(0, 65),
        metaDescription: `{{Consecuencia práctica}} para costos, precios o sanidad en finca.`,
        rationale: "Enfoque de interés: apela a la decisión del productor.",
      },
    ],
  };
}
