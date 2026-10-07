import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { logoDataUri } from "@/lib/logo-archivos";

const ruta = (archivo: string) => join(process.cwd(), "public/logo", archivo);

// Ancho, alto y tipo de color (6 = con transparencia) de la cabecera de un PNG.
function cabecera(archivo: string) {
  const b = readFileSync(ruta(archivo));
  assert.equal(b.subarray(1, 4).toString("latin1"), "PNG", `${archivo} no es un PNG`);
  return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20), color: b[25] };
}

test("las piezas del logo existen con la medida que piden cada sitio y cada plataforma", () => {
  assert.deepEqual(cabecera("contexto-ganadero-emblema.png"), { ancho: 1024, alto: 1024, color: 6 }, "el emblema va solo y con fondo transparente");
  assert.deepEqual(cabecera("contexto-ganadero-logo-512.png"), { ancho: 512, alto: 512, color: 6 }, "esquinas redondas: necesita transparencia");
  assert.equal(cabecera("contexto-ganadero-icon-bleed.png").ancho, 1024);
  assert.equal(cabecera("contexto-ganadero-maskable.png").ancho, 1024);
  assert.deepEqual({ ...cabecera("contexto-ganadero-og.png"), color: 0 }, { ancho: 1200, alto: 630, color: 0 }, "tarjeta de redes de 1200 × 630");
});

test("los íconos de la pestaña, de iOS y de la PWA se leen como data URI PNG", () => {
  for (const pieza of ["redondeado", "ios", "maskable"] as const) {
    const uri = logoDataUri(pieza);
    assert.ok(uri.startsWith("data:image/png;base64,"), pieza);
    assert.equal(Buffer.from(uri.split(",")[1], "base64").subarray(1, 4).toString("latin1"), "PNG");
  }
});
