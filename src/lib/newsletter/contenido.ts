import type { EditionContent } from "@/lib/newsletter/edition";
import { sanitizarItems, slugsDeItems } from "@/lib/newsletter/items";

/** Valida lo que llega del editor: el correo se genera a partir de estos textos. */
export function limpiarContenido(input: Partial<EditionContent>): { ok: true; content: EditionContent } | { ok: false; message: string } {
  const subject = String(input.subject ?? "").trim().slice(0, 150);
  const preheader = String(input.preheader ?? "").trim().slice(0, 200);
  const intro = String(input.intro ?? "").trim().slice(0, 3000);
  // El armado con secciones manda; una edición antigua o un cliente que solo manda la lista plana de notas es un armado sin encabezados.
  const conSecciones = sanitizarItems(input.items);
  const items = conSecciones.length > 0 ? conSecciones : sanitizarItems((Array.isArray(input.articleSlugs) ? input.articleSlugs : []).map((slug) => ({ t: "n", slug })));
  const slugs = slugsDeItems(items);
  if (subject.length < 3) return { ok: false, message: "Escribe un asunto (mínimo 3 caracteres)." };
  return { ok: true, content: { subject, preheader, intro, articleSlugs: slugs, items } };
}
