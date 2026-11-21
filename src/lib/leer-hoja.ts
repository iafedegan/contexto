/**
 * Lee una hoja de cálculo que sube quien redacta (Excel .xlsx o CSV) y la devuelve como tabla de texto (filas × columnas), en el navegador y sin
 * dependencias: un .xlsx es un ZIP con XML adentro; se abre con `DecompressionStream` y se lee la primera hoja con sus textos compartidos.
 * Solo la primera hoja y hasta 300 filas × 30 columnas (para una gráfica sobra).
 */
export type Tabla = string[][];
const MAX_FILAS = 300;
const MAX_COLS = 30;

export async function leerHoja(archivo: File): Promise<Tabla> {
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith(".csv") || nombre.endsWith(".tsv") || archivo.type === "text/csv") return recortar(leerCsv(await archivo.text()));
  if (nombre.endsWith(".xlsx")) return recortar(await leerXlsx(new Uint8Array(await archivo.arrayBuffer())));
  if (nombre.endsWith(".xls")) throw new Error("Ese es el formato viejo de Excel (.xls). Ábrelo en Excel y guárdalo como .xlsx o .csv.");
  throw new Error("Sube un archivo de Excel (.xlsx) o un .csv.");
}

const recortar = (t: Tabla): Tabla =>
  t
    .filter((f) => f.some((c) => c.trim() !== ""))
    .slice(0, MAX_FILAS)
    .map((f) => f.slice(0, MAX_COLS).map((c) => c.trim().slice(0, 80)));

/** CSV con separador «,», «;» o tabulador (el que más aparezca en la primera línea) y comillas dobles. */
export function leerCsv(texto: string): Tabla {
  const primera = texto.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].map((s) => [s, primera.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const filas: Tabla = [];
  let fila: string[] = [];
  let celda = "";
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(celda); celda = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda); filas.push(fila); fila = []; celda = "";
    } else celda += c;
  }
  if (celda !== "" || fila.length) { fila.push(celda); filas.push(fila); }
  return filas;
}

// --- .xlsx -----------------------------------------------------------------

async function inflar(datos: Uint8Array): Promise<Uint8Array> {
  const flujo = new Blob([datos as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/** Archivos del ZIP por nombre (lee el directorio central; admite «guardado» y «deflate»). */
async function abrirZip(zip: Uint8Array, quiero: (n: string) => boolean): Promise<Map<string, string>> {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let fin = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 66_000); i--) if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error("El archivo no es un Excel válido.");
  const total = dv.getUint16(fin + 10, true);
  let p = dv.getUint32(fin + 16, true);
  const salida = new Map<string, string>();
  const dec = new TextDecoder();
  for (let k = 0; k < total; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(p + 10, true);
    const comprimido = dv.getUint32(p + 20, true);
    const largoNombre = dv.getUint16(p + 28, true);
    const largoExtra = dv.getUint16(p + 30, true);
    const largoComent = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const nombre = dec.decode(zip.subarray(p + 46, p + 46 + largoNombre));
    p += 46 + largoNombre + largoExtra + largoComent;
    if (!quiero(nombre)) continue;
    const inicio = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const crudo = zip.subarray(inicio, inicio + comprimido);
    const datos = metodo === 0 ? crudo : metodo === 8 ? await inflar(crudo) : null;
    if (datos) salida.set(nombre, dec.decode(datos));
  }
  return salida;
}

const columna = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

export async function leerXlsx(zip: Uint8Array): Promise<Tabla> {
  const archivos = await abrirZip(zip, (n) => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n) || n === "xl/workbook.xml");
  const hojas = [...archivos.keys()].filter((n) => n.startsWith("xl/worksheets/")).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  if (!hojas.length) throw new Error("No encontré ninguna hoja en ese Excel.");
  const parser = new DOMParser();
  const compartidos: string[] = [];
  const ss = archivos.get("xl/sharedStrings.xml");
  if (ss) for (const si of Array.from(parser.parseFromString(ss, "application/xml").getElementsByTagName("si"))) compartidos.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""));
  const hoja = parser.parseFromString(archivos.get(hojas[0])!, "application/xml");
  const tabla: Tabla = [];
  for (const row of Array.from(hoja.getElementsByTagName("row"))) {
    const fila: string[] = [];
    for (const c of Array.from(row.getElementsByTagName("c"))) {
      const ref = c.getAttribute("r") ?? "";
      const i = ref ? columna(ref) : fila.length;
      if (i >= MAX_COLS) continue;
      const tipo = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      let valor = v;
      if (tipo === "s") valor = compartidos[Number(v)] ?? "";
      else if (tipo === "inlineStr") valor = Array.from(c.getElementsByTagName("t")).map((t) => t.textContent ?? "").join("");
      else if (tipo === "b") valor = v === "1" ? "Sí" : "No";
      while (fila.length < i) fila.push("");
      fila[i] = valor;
    }
    tabla.push(fila);
  }
  return tabla;
}
