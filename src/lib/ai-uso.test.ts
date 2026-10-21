import test, { before } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";

let uso: typeof import("@/lib/ai-uso");
before(async () => {
  await prepararBd();
  uso = await import("@/lib/ai-uso");
});

test("el consumo por modelo se suma entre llamadas, también las simultáneas, y se separa por modelo", async () => {
  await uso.registrarUsoModelo("google:gemini-3.8-flash", 1000, 200, 0.01);
  await Promise.all([1, 2, 3, 4].map(() => uso.registrarUsoModelo("google:gemini-3.8-flash", 500, 100, 0.005)));
  await uso.registrarUsoModelo("anthropic:claude-sonnet-5", 2000, 400, 0.04);

  const r = await uso.resumenUsoIA("00000000-0000-4000-8000-000000000001", true);
  const flash = r.modelos.find((m) => m.ref === "google:gemini-3.8-flash")!;
  assert.equal(flash.entrada, 3000);
  assert.equal(flash.salida, 600);
  assert.equal(flash.llamadas, 5);
  assert.ok(Math.abs(flash.usd - 0.03) < 1e-9);
  assert.equal(r.modelos.find((m) => m.ref === "anthropic:claude-sonnet-5")!.llamadas, 1);
  assert.ok(Math.abs(r.totalUsd - 0.07) < 1e-9);
  // Ordenados de mayor a menor gasto.
  assert.deepEqual(r.modelos.map((m) => m.modelo), ["claude-sonnet-5", "gemini-3.8-flash"]);
});

test("valores raros no rompen ni restan: negativos y NaN cuentan como cero", async () => {
  await uso.registrarUsoModelo("google:otro", -5, Number.NaN, Number.NaN);
  const r = await uso.resumenUsoIA("00000000-0000-4000-8000-000000000001", true);
  const o = r.modelos.find((m) => m.ref === "google:otro")!;
  assert.equal(o.entrada, 0);
  assert.equal(o.salida, 0);
  assert.equal(o.usd, 0);
});

test("todos ven el consumo por modelo y lo suyo; solo el administrador ve el presupuesto del asistente", async () => {
  const redactor = await uso.resumenUsoIA("00000000-0000-4000-8000-0000000000aa", false);
  assert.equal(redactor.admin, null);
  assert.ok(redactor.modelos.length > 0);
  assert.equal(redactor.yo.gastoUsd, 0);
  const admin = await uso.resumenUsoIA("00000000-0000-4000-8000-000000000001", true);
  assert.ok(admin.admin && admin.admin.presupuestoAsistenteUsd > 0);
});
