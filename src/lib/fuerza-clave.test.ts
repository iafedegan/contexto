import test from "node:test";
import assert from "node:assert/strict";
import { fuerzaClave, generarClaveSegura, NIVEL_MINIMO } from "./fuerza-clave";

test("las contraseñas fáciles quedan por debajo del mínimo", () => {
  for (const c of ["1234567890", "contexto2026", "Fedegan2026!", "aaaaaaaaaaaa", "qwertyuiop12", "password1234", "Contraseña123"]) {
    assert.ok(fuerzaClave(c).nivel < NIVEL_MINIMO, `${c} → ${fuerzaClave(c).nivel}`);
  }
  assert.ok(fuerzaClave("edgarbarragan77", ["Edgar Barragán", "edgar@x.com"]).nivel < NIVEL_MINIMO);
  assert.equal(fuerzaClave("corta").nivel, 0);
});

test("las difíciles pasan", () => {
  for (const c of ["Tr3s-vacas-y-1400-arboles", "jkwhewudhiudhwied", "Hk7m-Qr2x-Pb9s-Tn4w", "potrero azul lluvioso"]) {
    assert.ok(fuerzaClave(c).nivel >= NIVEL_MINIMO, `${c} → ${fuerzaClave(c).nivel}`);
  }
});

test("la generada es muy difícil y no se repite", () => {
  const a = generarClaveSegura();
  assert.match(a, /^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
  assert.equal(fuerzaClave(a).nivel, 4);
  assert.notEqual(a, generarClaveSegura());
});
