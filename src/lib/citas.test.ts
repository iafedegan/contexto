import test from "node:test";
import assert from "node:assert/strict";
import { analizarCitas, normalizarCitas } from "@/lib/citas";

test("una respuesta que cita fragmentos existentes es válida", () => {
  const r = analizarCitas("El novillo subió 4 % [1]. En el Caribe crece el silvopastoreo [3][1].", 3);
  assert.deepEqual(r, { usadas: [1, 3], invalidas: false, valida: true });
});

test("una respuesta sin ningún marcador NO es válida (antes se daban por citadas todas las fuentes)", () => {
  const r = analizarCitas("El precio del novillo subió bastante este mes.", 5);
  assert.deepEqual(r, { usadas: [], invalidas: false, valida: false });
});

test("un marcador que no apunta a ningún fragmento invalida toda la respuesta", () => {
  assert.equal(analizarCitas("Dato [1] y otro dato [9].", 3).valida, false);
  assert.equal(analizarCitas("Dato [0].", 3).valida, false);
  assert.equal(analizarCitas("Dato [1] [2] [3] [4].", 3).invalidas, true);
});

test("los corchetes que no son marcadores no cuentan", () => {
  assert.equal(analizarCitas("Ver [aquí] y [x1] sin números.", 3).valida, false);
  assert.equal(analizarCitas("", 3).valida, false);
  assert.equal(analizarCitas("Sin fuentes [1]", 0).valida, false);
});

test("las citas agrupadas se separan en marcadores sueltos", () => {
  assert.equal(normalizarCitas("Subió 4 % [1, 2] y bajó [3,4]."), "Subió 4 % [1][2] y bajó [3][4].");
  assert.equal(normalizarCitas("Dato [1-3]"), "Dato [1][2][3]");
  assert.equal(normalizarCitas("Ya está [2]"), "Ya está [2]");
});

test("una respuesta con citas agrupadas es válida tras normalizar", () => {
  const r = analizarCitas(normalizarCitas("El precio subió [1, 2]."), 3);
  assert.deepEqual(r.usadas, [1, 2]);
  assert.equal(r.valida, true);
});
