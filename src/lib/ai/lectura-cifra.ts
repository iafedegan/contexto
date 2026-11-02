/**
 * La respuesta del Observatorio llega como texto («Colombia (oct/2026): 9.795 $ por kilo en pie; Llanos: 9.101 $ por kilo en pie»). Aquí se separa
 * para mostrarla como dato: la cifra grande y las demás en filas. Si alguna parte no tiene esa forma devuelve `null` y se muestra el texto tal cual.
 */
export type FilaCifra = { serie: string; periodo: string | null; valor: string; numero: number; unidad: string };

export function leerCifra(resumen: string): FilaCifra[] | null {
  const partes = resumen.split("; ").map((p) => p.trim()).filter(Boolean);
  if (!partes.length) return null;
  const filas: FilaCifra[] = [];
  for (const parte of partes) {
    const m = parte.match(/^(.+?)(?: \(([^()]+)\))?: (-?[\d.]+(?:,\d+)?)(?: (.+))?$/);
    if (!m) return null;
    filas.push({ serie: m[1], periodo: m[2] ?? null, valor: m[3], numero: Number(m[3].replace(/\./g, "").replace(",", ".")), unidad: m[4] ?? "" });
  }
  return filas;
}
