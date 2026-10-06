import test from "node:test";
import assert from "node:assert/strict";
import { tipoPorFirma } from "@/lib/media-firma";

const bytes = (...partes: (number[] | string)[]) =>
  Uint8Array.from(partes.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)).concat(new Array(16).fill(0)));

test("reconoce cada formato admitido por su firma", () => {
  assert.deepEqual(tipoPorFirma(bytes([0xff, 0xd8, 0xff, 0xe0])), { mime: "image/jpeg", ext: "jpg", kind: "imagen" });
  assert.deepEqual(tipoPorFirma(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a])), { mime: "image/png", ext: "png", kind: "imagen" });
  assert.equal(tipoPorFirma(bytes("GIF89a"))?.mime, "image/gif");
  assert.equal(tipoPorFirma(bytes("GIF87a"))?.mime, "image/gif");
  assert.equal(tipoPorFirma(bytes("RIFF", [1, 2, 3, 4], "WEBP"))?.mime, "image/webp");
  assert.equal(tipoPorFirma(bytes([0, 0, 0, 0x1c], "ftyp", "avif"))?.mime, "image/avif");
  assert.equal(tipoPorFirma(bytes([0, 0, 0, 0x20], "ftyp", "isom"))?.mime, "video/mp4");
  assert.equal(tipoPorFirma(bytes([0, 0, 0, 0x18], "ftyp", "mp42"))?.kind, "video");
  assert.equal(tipoPorFirma(bytes([0x1a, 0x45, 0xdf, 0xa3]))?.mime, "video/webm");
});

test("lo que parece otra cosa no se admite, aunque se declare como imagen", () => {
  assert.equal(tipoPorFirma(bytes("<!DOCTYPE html><script>alert(1)</script>")), null);
  assert.equal(tipoPorFirma(bytes("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>")), null);
  assert.equal(tipoPorFirma(bytes("MZ", [0x90, 0, 3, 0])), null, "ejecutable de Windows");
  assert.equal(tipoPorFirma(bytes("%PDF-1.7")), null);
  assert.equal(tipoPorFirma(bytes("RIFF", [1, 2, 3, 4], "WAVE")), null, "RIFF que no es WebP");
  assert.equal(tipoPorFirma(new Uint8Array(0)), null);
  assert.equal(tipoPorFirma(Uint8Array.from([0xff, 0xd8])), null, "demasiado corto para fiarse");
});
