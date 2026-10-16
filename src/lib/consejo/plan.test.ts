import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG_BASE, construirParrilla, lunesDe, notasPorSemana, sanearConfig, sumarDias, tocaRedactar } from "@/lib/consejo/plan";

const cfg = sanearConfig({ ...CONFIG_BASE, cuotas: [{ seccion: "ganaderia", porDia: 2 }, { seccion: "economia", porDia: 1, aprobacion: "auto" }] });
const pasado = new Date("2026-01-01T00:00:00Z");

test("lunesDe y sumarDias trabajan con fechas de Colombia", () => {
  assert.equal(lunesDe("2026-10-16"), "2026-10-12"); // viernes → lunes
  assert.equal(lunesDe("2026-10-12"), "2026-10-12");
  assert.equal(lunesDe("2026-10-18"), "2026-10-12"); // domingo → lunes anterior
  assert.equal(sumarDias("2026-10-12", 6), "2026-10-18");
});

test("la parrilla respeta días, cuotas y no apila las secciones a la misma hora", () => {
  const p = construirParrilla("2026-10-12", cfg, pasado);
  assert.equal(p.length, notasPorSemana(cfg));
  assert.equal(p.length, 15); // 5 días × (2 + 1)
  const lunes = p.filter((c) => c.publicaEn.toISOString().startsWith("2026-10-12") || c.publicaEn.toISOString().startsWith("2026-10-13T0"));
  const horas = new Set(lunes.slice(0, 3).map((c) => c.publicaEn.getTime()));
  assert.equal(horas.size, 3, "tres notas del mismo día en tres horas distintas");
  assert.ok(p.every((c, i) => i === 0 || p[i - 1].publicaEn <= c.publicaEn), "ordenada por fecha");
  assert.equal(p.find((c) => c.seccion === "economia")?.aprobacion, "auto");
  assert.equal(p.find((c) => c.seccion === "ganaderia")?.aprobacion, "manual");
});

test("no se crean casillas en el pasado", () => {
  const p = construirParrilla("2026-10-12", cfg, new Date("2026-10-14T23:59:00-05:00"));
  assert.ok(p.every((c) => c.publicaEn.getTime() > new Date("2026-10-14T23:59:00-05:00").getTime()));
  assert.equal(p.length, 6); // jueves y viernes
});

test("sanearConfig corrige valores raros", () => {
  const c = sanearConfig({ dias: [0, 3, 3, 9], horas: ["25:00", "09:30"], cuotas: [{ seccion: "x y", porDia: 2 }, { seccion: "ok", porDia: 99 }], antelacionHoras: 500 });
  assert.deepEqual(c.dias, [3]);
  assert.deepEqual(c.horas, ["09:30"]);
  assert.deepEqual(c.cuotas, [{ seccion: "ok", porDia: 6 }]);
  assert.equal(c.antelacionHoras, 48);
});

test("tocaRedactar usa la antelación configurada", () => {
  const sale = new Date("2026-10-14T10:00:00-05:00");
  assert.equal(tocaRedactar(sale, { antelacionHoras: 4 }, new Date("2026-10-14T05:30:00-05:00")), false);
  assert.equal(tocaRedactar(sale, { antelacionHoras: 4 }, new Date("2026-10-14T06:30:00-05:00")), true);
});
