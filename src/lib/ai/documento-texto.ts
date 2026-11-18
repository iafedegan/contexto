import { inflateRawSync } from "node:zlib";

/**
 * Texto de un documento que sube la redacción, sin IA: texto plano y Word (.docx). El PDF lo lee el modelo (ver `leerDocumentoCore`).
 * Un .docx es un zip: se localiza `word/document.xml` por el directorio central y se descomprime con zlib; no hace falta otra librería.
 */

const decodificar = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

/** El XML de Word → texto: un párrafo por línea, tabuladores y saltos respetados. */
export function textoDeXmlWord(xml: string): string {
  return decodificar(
    xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:(?:br|cr)\/?>/g, "\n")
      .replace(/<\/w:p>/g, "\n\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Lee `word/document.xml` de un .docx. `null` si no es un zip válido o no trae ese archivo. */
export function textoDeDocx(bytes: Uint8Array): string | null {
  const b = Buffer.from(bytes);
  // Fin del directorio central (firma 0x06054b50), buscado desde el final.
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const total = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  for (let n = 0; n < total && p + 46 <= b.length && b.readUInt32LE(p) === 0x02014b50; n++) {
    const metodo = b.readUInt16LE(p + 10);
    const comprimido = b.readUInt32LE(p + 20);
    const largoNombre = b.readUInt16LE(p + 28);
    const largoExtra = b.readUInt16LE(p + 30);
    const largoComentario = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const nombre = b.toString("utf8", p + 46, p + 46 + largoNombre);
    if (nombre === "word/document.xml") {
      if (local + 30 > b.length) return null;
      const inicio = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
      const datos = b.subarray(inicio, inicio + comprimido);
      try {
        const xml = (metodo === 0 ? datos : inflateRawSync(datos, { maxOutputLength: 40 * 1024 * 1024 })).toString("utf8");
        return textoDeXmlWord(xml);
      } catch {
        return null;
      }
    }
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return null;
}
