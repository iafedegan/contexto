"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { generateObject } from "ai";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getAiModel } from "@/lib/ai-provider";
import { registrarUsoIA, verificarCuotaIA } from "@/lib/ai-cuota";
import { leerEnlacesCore } from "@/lib/ai-core";
import { borrarEstilo, getEstilo, guardarEstilo } from "@/lib/ai/estilo";
import { ESTILO_LIMITES, aVista, contarPalabras, type EstiloVista, type FuenteEstilo } from "@/lib/ai/estilo-tipos";

/**
 * «Mi estilo de escritura»: cada persona (sea cual sea su rol) carga muestras de lo que ha escrito, por enlace o pegando el texto, y la
 * IA saca un diagnóstico de su tono y su forma de escribir. Ese diagnóstico, si lo deja activo, se suma a las instrucciones cuando
 * la IA redacta POR ELLA (solo la forma: las reglas de veracidad y de fuentes no cambian). Todo es de la persona: nadie más lo ve.
 */

// Lo que devuelve cada acción: si salió bien, un mensaje y el estado actualizado para pintar.
export type EstiloResultado = { ok: boolean; message: string; estado?: EstiloVista };

const nueva = (e: Awaited<ReturnType<typeof getEstilo>>, message: string, ok = true): EstiloResultado => ({ ok, message, estado: aVista(e) });

/** Estado actual de la persona con sesión. */
export async function estadoEstilo(): Promise<EstiloVista> {
  const user = await requireRole("redactor");
  return aVista(await getEstilo(user.id));
}

/** Añade notas de la persona por su dirección (una por línea, hasta 5 a la vez). */
export async function agregarEnlaces(urls: string): Promise<EstiloResultado> {
  const user = await requireRole("redactor");
  const e = await getEstilo(user.id);
  const sitio = ESTILO_LIMITES.muestras - e.fuentes.length;
  if (sitio <= 0) return nueva(e, `Ya tienes ${ESTILO_LIMITES.muestras} muestras: quita alguna para añadir otra.`, false);
  const lista = [...new Set(urls.split(/[\s,]+/).map((x) => x.trim()).filter((x) => /^https?:\/\//i.test(x)))]
    .filter((u) => !e.fuentes.some((f) => f.url === u))
    .slice(0, Math.min(5, sitio));
  if (!lista.length) return nueva(e, "Pega al menos un enlace nuevo que empiece por http:// o https://.", false);
  const r = await leerEnlacesCore(user.id, { urls: lista.join("\n") });
  if (!r.ok) return nueva(e, r.error, false);
  for (const m of r.materiales) {
    const texto = m.text.slice(0, ESTILO_LIMITES.caracteresPorMuestra);
    e.fuentes.push({ id: randomUUID(), tipo: "enlace", titulo: m.title.slice(0, 160), url: m.url, texto, palabras: contarPalabras(texto), en: new Date().toISOString() });
  }
  await guardarEstilo(user.id, e);
  revalidatePath("/panel/configuracion");
  const falta = r.fallidos.length ? ` No se pudo leer ${r.fallidos.length}: ${r.fallidos.join(", ")} (puede estar protegido o ser un video).` : "";
  return nueva(e, `Se añadieron ${r.materiales.length} muestra(s).${falta}`);
}

/** Añade un texto pegado o cargado desde un archivo. */
export async function agregarTexto(titulo: string, texto: string): Promise<EstiloResultado> {
  const user = await requireRole("redactor");
  const e = await getEstilo(user.id);
  if (e.fuentes.length >= ESTILO_LIMITES.muestras) return nueva(e, `Ya tienes ${ESTILO_LIMITES.muestras} muestras: quita alguna para añadir otra.`, false);
  const limpio = texto.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, ESTILO_LIMITES.caracteresPorMuestra);
  if (contarPalabras(limpio) < 120) return nueva(e, "El texto es muy corto: pega una nota completa (mínimo ~120 palabras).", false);
  e.fuentes.push({ id: randomUUID(), tipo: "texto", titulo: (titulo.trim() || "Texto pegado").slice(0, 160), texto: limpio, palabras: contarPalabras(limpio), en: new Date().toISOString() });
  await guardarEstilo(user.id, e);
  revalidatePath("/panel/configuracion");
  return nueva(e, "Muestra añadida.");
}

/** Quita una muestra. */
export async function quitarFuente(id: string): Promise<EstiloResultado> {
  const user = await requireRole("redactor");
  const e = await getEstilo(user.id);
  e.fuentes = e.fuentes.filter((f: FuenteEstilo) => f.id !== id);
  await guardarEstilo(user.id, e);
  revalidatePath("/panel/configuracion");
  return nueva(e, "Muestra quitada.");
}

/** Enciende o apaga el uso del estilo al redactar con IA (el diagnóstico se conserva). */
export async function alternarEstilo(activo: boolean): Promise<EstiloResultado> {
  const user = await requireRole("redactor");
  const e = await getEstilo(user.id);
  e.activo = activo;
  await guardarEstilo(user.id, e);
  revalidatePath("/panel/configuracion");
  return nueva(e, activo ? "La IA escribirá con tu estilo." : "La IA dejará de usar tu estilo.");
}

/** Borra todo: muestras y diagnóstico. */
export async function borrarMiEstilo(): Promise<EstiloResultado> {
  const user = await requireRole("redactor");
  await borrarEstilo(user.id);
  revalidatePath("/panel/configuracion");
  return nueva({ fuentes: [], diagnostico: null, activo: true }, "Se borraron tus muestras y tu diagnóstico.");
}

// Forma del diagnóstico que debe devolver el modelo.
const esquema = z.object({
  resumen: z.string().min(40).max(700).describe("Retrato del estilo en 2-3 frases, en segunda persona («Escribes…»)"),
  tono: z.array(z.string().min(2).max(60)).min(2).max(6),
  voz: z.string().min(10).max(300).describe("Persona gramatical, cercanía con el lector, uso de «usted/tú/nosotros», presencia del autor"),
  estructura: z.string().min(10).max(400).describe("Cómo arma la nota: entradilla, párrafos, subtítulos, citas, datos"),
  ritmo: z.string().min(10).max(300).describe("Largo de frases y párrafos, uso de puntuación"),
  vocabulario: z.string().min(10).max(300).describe("Registro, tecnicismos, giros y expresiones propias"),
  aperturas: z.string().min(10).max(300).describe("Cómo suele empezar una nota"),
  cierres: z.string().min(10).max(300).describe("Cómo suele terminarla"),
  fortalezas: z.array(z.string().min(5).max(160)).max(6),
  evitar: z.array(z.string().min(5).max(160)).max(8).describe("Cosas que NO hace y que la IA debe evitar al imitarlo"),
  reglas: z.array(z.string().min(10).max(220)).min(4).max(12).describe("Instrucciones breves y accionables para redactar como esta persona, en imperativo"),
});

/** Genera (o regenera) el diagnóstico de estilo con las muestras cargadas. */
export async function generarDiagnostico(): Promise<EstiloResultado> {
  const user = await requireRole("redactor");
  const e = await getEstilo(user.id);
  const palabras = e.fuentes.reduce((s, f) => s + f.palabras, 0);
  if (e.fuentes.length < ESTILO_LIMITES.minimoMuestras || palabras < ESTILO_LIMITES.minimoPalabras) {
    return nueva(e, `Para un diagnóstico fiable carga al menos ${ESTILO_LIMITES.minimoMuestras} notas tuyas (y unas ${ESTILO_LIMITES.minimoPalabras.toLocaleString("es-CO")} palabras en total). Tienes ${e.fuentes.length} y ${palabras.toLocaleString("es-CO")} palabras.`, false);
  }
  const model = await getAiModel();
  if (!model) return nueva(e, "Falta la clave del modelo de IA (la conecta un administrador en Configuración → Asistente).", false);
  const cuota = await verificarCuotaIA(user.id);
  if (!cuota.ok) return nueva(e, cuota.message, false);
  try {
    const muestras = e.fuentes.map((f, i) => `=== MUESTRA ${i + 1}: ${f.titulo} ===\n${f.texto}`).join("\n\n").slice(0, 70_000);
    const { object, usage } = await generateObject({
      model,
      schema: esquema,
      system:
        "Eres un editor de estilo de un medio periodístico colombiano. Analizas la FORMA de escribir de una persona a partir de sus textos: tono, voz, estructura, ritmo, vocabulario, aperturas y cierres. " +
        "NO describes los temas ni los hechos de las notas y no copias frases largas. Basas cada observación en lo que realmente aparece en las muestras (no en estereotipos). " +
        "Las reglas deben servir para que otra persona o una IA redacte como ella, en imperativo y de forma concreta. Escribe en español de Colombia.",
      prompt: `Estas son ${e.fuentes.length} muestras escritas por la misma persona (${palabras.toLocaleString("es-CO")} palabras). Haz el diagnóstico de su estilo de escritura.\n\n${muestras}`,
      temperature: 0.3,
      abortSignal: AbortSignal.timeout(60_000),
    });
    await registrarUsoIA(user.id, usage);
    e.diagnostico = { ...object, muestras: e.fuentes.length, palabras, generadoEn: new Date().toISOString() };
    e.activo = true;
    await guardarEstilo(user.id, e);
    revalidatePath("/panel/configuracion");
    return nueva(e, "Diagnóstico listo. Desde ahora la IA escribirá con tu estilo cuando redactes con ella.");
  } catch (err) {
    console.error("generarDiagnostico:", err);
    return nueva(e, "No se pudo generar el diagnóstico ahora. Inténtalo de nuevo en un momento.", false);
  }
}
