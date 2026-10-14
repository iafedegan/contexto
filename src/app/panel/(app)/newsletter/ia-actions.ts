"use server";

import { generateText } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { getAiModel } from "@/lib/ai-provider";
import { registrarUsoIA, verificarCuotaIA } from "@/lib/ai-cuota";
import { hit } from "@/lib/rate-limit";

/**
 * «Redactar con IA» del boletín: escribe el saludo de la redacción a partir de las notas que la persona ya eligió para la edición.
 * Solo propone un texto que la persona lee y edita (nada se envía ni se guarda por su cuenta); usa únicamente los títulos y resúmenes
 * de esas notas, y cuenta contra la cuota de IA de quien lo pide.
 */
const SISTEMA = `Eres el editor de un boletín de noticias del sector ganadero colombiano. Escribe el SALUDO de la redacción que va al inicio del correo.
Reglas:
- Español de Colombia, tono cercano y profesional, sin emojis ni signos de exclamación en exceso.
- Entre 60 y 110 palabras, en uno o dos párrafos cortos.
- Resume lo más importante de las notas dadas y menciona dos o tres temas; ve de lo más relevante a lo menos.
- Usa SOLO lo que dicen los títulos y resúmenes. No inventes cifras, nombres, fechas ni conclusiones.
- No pongas título, asunto ni firma; no uses viñetas ni enlaces. Termina invitando a leer las notas.
Responde únicamente con el texto del saludo.`;

export async function redactarMensajeConIA(slugs: string[]): Promise<{ ok: boolean; message: string; texto?: string }> {
  const user = await requirePermiso("newsletter");
  const lista = [...new Set((Array.isArray(slugs) ? slugs : []).filter((s) => typeof s === "string" && s.length <= 200))].slice(0, 12);
  if (lista.length === 0) return { ok: false, message: "Primero elige las notas del boletín (paso 2): el texto se escribe a partir de ellas." };

  const limite = await hit(`newsletter-ia:${user.id}`, 30, 3600);
  if (!limite.allowed) return { ok: false, message: "Hiciste muchas peticiones seguidas. Espera un rato e inténtalo de nuevo." };
  const model = await getAiModel();
  if (!model) return { ok: false, message: "Falta conectar el modelo de IA (lo hace un administrador en Configuración → Asistente de IA)." };
  const cuota = await verificarCuotaIA(user.id);
  if (!cuota.ok) return { ok: false, message: cuota.message };

  const filas = await db
    .select({ slug: articles.slug, titulo: articles.title, resumen: articles.excerpt, seccion: categories.name })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(and(inArray(articles.slug, lista), eq(articles.status, "publicado")));
  if (filas.length === 0) return { ok: false, message: "No encontré esas notas publicadas." };
  // En el orden en que van en el boletín (la primera es la destacada).
  const ordenadas = lista.flatMap((s) => filas.filter((f) => f.slug === s));
  const notas = ordenadas.map((n, i) => `${i + 1}. [${n.seccion ?? "Sin sección"}] ${n.titulo}\n   ${(n.resumen ?? "").slice(0, 300)}`).join("\n");

  try {
    const { text, usage } = await generateText({
      model,
      system: SISTEMA,
      prompt: `Notas de esta edición, de la más destacada a la menos:\n\n${notas}`,
      temperature: 0.4,
      maxOutputTokens: 400,
      abortSignal: AbortSignal.timeout(25_000),
    });
    await registrarUsoIA(user.id, usage);
    const texto = text.trim().replace(/^["«]|["»]$/g, "").slice(0, 2500);
    if (!texto) return { ok: false, message: "La IA no devolvió texto. Inténtalo de nuevo." };
    return { ok: true, message: "Texto listo: léelo y ajústalo a tu gusto.", texto };
  } catch (e) {
    console.error("newsletter: fallo al redactar con IA", e);
    return { ok: false, message: "No se pudo redactar ahora. Inténtalo de nuevo en un momento." };
  }
}
