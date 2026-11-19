/**
 * Crédito de la foto de portada. Toda foto lo lleva: las de IA y las del archivo ya vienen con el suyo; las que sube una persona deben
 * traerlo en un formato que se lea claro: «Foto: Nombre Apellido / Medio» (o «Cortesía: …», «Ilustración: …», «Archivo …»).
 */
export const FORMATO_CREDITO = "Foto: Nombre Apellido / Medio";

/** Atajos del formulario: lo que se escribe al elegir cada origen de la foto. */
export const ORIGENES_CREDITO = [
  { id: "propia", etiqueta: "Foto de una persona", texto: "Foto: " },
  { id: "cortesia", etiqueta: "Cortesía", texto: "Cortesía: " },
  { id: "archivo", etiqueta: "Archivo CONtexto Ganadero", texto: "Archivo CONtexto Ganadero" },
  { id: "fedegan", etiqueta: "Archivo FEDEGÁN", texto: "Archivo FEDEGÁN" },
] as const;

const CON_MARCA = /(foto(grafía)?|imagen|ilustración|cortesía|captura|crédito)\s*:\s*\S{3,}/i;
const ARCHIVO = /\barchivo\s+\S{2,}/i;
const IA = /generada con (inteligencia artificial|ia)\b/i;

/** ¿El texto es un crédito válido? Con marca y nombre («Foto: Ana Ruiz / El Tiempo»), «Archivo …» o imagen generada con IA. */
export function creditoFotoValido(texto: string | null | undefined): boolean {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  if (t.length < 5 || t.length > 300) return false;
  return CON_MARCA.test(t) || ARCHIVO.test(t) || IA.test(t);
}
