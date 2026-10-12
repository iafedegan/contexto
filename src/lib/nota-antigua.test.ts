import test from "node:test";
import assert from "node:assert/strict";
import { slugDeNotaAntigua } from "@/lib/nota-antigua";

test("reconoce /seccion/titulo del sitio anterior", () => {
  assert.equal(slugDeNotaAntigua(["regiones", "incendio-lleva-50-dias-en-buga"]), "incendio-lleva-50-dias-en-buga");
  assert.equal(slugDeNotaAntigua(["otrossistemP", "mortandad-de-peces-en-la-tesca"]), "mortandad-de-peces-en-la-tesca");
});

test("ignora rutas que no tienen esa forma", () => {
  assert.equal(slugDeNotaAntigua(["regiones"]), null);
  assert.equal(slugDeNotaAntigua(["a", "b", "c"]), null);
  assert.equal(slugDeNotaAntigua(["regiones", "../etc/passwd"]), null);
  assert.equal(slugDeNotaAntigua(["regiones", "Titulo Con Espacios"]), null);
});
