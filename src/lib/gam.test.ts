import test from "node:test";
import assert from "node:assert/strict";
import { nombreUnidadGam, prefijoGam } from "@/lib/gam";

test("el prefijo de las unidades sale de la dirección", () => {
  assert.equal(prefijoGam("/"), "home");
  assert.equal(prefijoGam("/en"), "home");
  assert.equal(prefijoGam("/categoria/colombia"), "colombia");
  assert.equal(prefijoGam("/ganaderia/una-nota"), "ganaderia");
  assert.equal(prefijoGam("/categoria/radio"), null);
  assert.equal(prefijoGam("/observatorio"), null);
});

test("la caja de 336×280 es b4 en la portada y b7 en las secciones", () => {
  assert.equal(nombreUnidadGam("home", "caja"), "home_b4");
  assert.equal(nombreUnidadGam("opinion", "caja"), "opinion_b7");
  assert.equal(nombreUnidadGam("mundo", "b5"), "mundo_b5");
});
