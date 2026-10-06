import "server-only";


/** Cifras (con al menos 2 dígitos) del cuerpo que no constan en el material de respaldo. */
export function cifrasSinRespaldo(html: string, respaldo: string): string[] {
  // Deja solo los dígitos de una cifra para compararla sin separadores de miles ni decimales.
  const dig = (x: string) => x.replace(/[.,\s]/g, "");
  const base = new Set((respaldo.match(/\d[\d.,]*\d|\d/g) ?? []).map(dig));
  const texto = html.replace(/<[^>]+>/g, " ");
  const malas = new Set<string>();
  for (const m of texto.match(/\d[\d.,]*\d/g) ?? []) if (!base.has(dig(m))) malas.add(m);
  return [...malas];
}

/** Texto comparable: sin etiquetas, tildes, signos ni mayúsculas, con los espacios colapsados. */
const comparable = (x: string) =>
  x.replace(/<[^>]+>/g, " ").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Citas textuales («…», “…” o "…" de 5+ palabras) del cuerpo que NO aparecen literalmente en el material de respaldo. */
export function citasSinRespaldo(html: string, respaldo: string): string[] {
  const base = comparable(respaldo);
  const texto = html.replace(/<[^>]+>/g, "");
  const malas: string[] = [];
  for (const m of texto.matchAll(/«([^»]+)»|“([^”]+)”|"([^"]+)"/g)) {
    const cita = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (cita.split(/\s+/).length < 5) continue;
    if (!base.includes(comparable(cita))) malas.push(cita);
  }
  return malas;
}

/** Quita los párrafos, viñetas y citas que contienen una cita inventada: mejor omitir que atribuir palabras que nadie dijo. */
export function sinCitasInventadas(html: string, malas: string[]): string {
  if (!malas.length) return html;
  const fuera = malas.map(comparable);
  return html.replace(/<(p|li|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi, (blk) => {
    const t = comparable(blk);
    return fuera.some((m) => t.includes(m)) ? "" : blk;
  });
}

/** Quita los párrafos/viñetas con cifras que no constan en las fuentes: mejor omitir que inventar. */
export function sinCifrasInventadas(html: string, malas: string[]): string {
  if (!malas.length) return html;
  return html.replace(/<(p|li)\b[^>]*>[\s\S]*?<\/\1>/gi, (blk) => (malas.some((m) => blk.includes(m)) ? "" : blk));
}
