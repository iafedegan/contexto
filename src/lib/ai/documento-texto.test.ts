import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { textoDeDocx, textoDeXmlWord } from "@/lib/ai/documento-texto";

function zipCon(nombre: string, contenido: string): Uint8Array {
  const datos = deflateRawSync(Buffer.from(contenido));
  const n = Buffer.from(nombre);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(datos.length, 18); local.writeUInt32LE(contenido.length, 22); local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(datos.length, 20); central.writeUInt32LE(contenido.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(0, 42);
  const fin = Buffer.alloc(22);
  const dirOffset = local.length + n.length + datos.length;
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(1, 8); fin.writeUInt16LE(1, 10); fin.writeUInt32LE(central.length + n.length, 12); fin.writeUInt32LE(dirOffset, 16);
  return Buffer.concat([local, n, datos, central, n, fin]);
}

test("el XML de Word se vuelve texto con un párrafo por línea", () => {
  const xml = "<w:p><w:r><w:t>Hola &amp; adiós</w:t></w:r></w:p><w:p><w:r><w:t>Segundo</w:t></w:r></w:p>";
  assert.equal(textoDeXmlWord(xml), "Hola & adiós\n\nSegundo");
});

test("un .docx se lee por su directorio central; algo que no es zip da null", () => {
  const docx = zipCon("word/document.xml", "<w:p><w:t>El hato creció 4 %</w:t></w:p>");
  assert.equal(textoDeDocx(docx), "El hato creció 4 %");
  assert.equal(textoDeDocx(Buffer.from("no soy un zip")), null);
});
