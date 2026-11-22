import test from "node:test";
import assert from "node:assert/strict";
import { mismoDiseno, normalizeLayout } from "@/lib/home-layout-normalize";
import { DEFAULT_HOME_LAYOUT } from "@/lib/home-layout";
import type { HomeLayoutConfig } from "@/db/schema";

// Lo que devuelve la base al leer el diseño guardado: jsonb no conserva el orden de las claves ni los `undefined`.
const comoEnLaBase = (l: HomeLayoutConfig): HomeLayoutConfig => {
  const plano = JSON.parse(JSON.stringify(l)) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(plano).reverse()) as HomeLayoutConfig;
};

test("el diseño guardado y el mismo diseño vuelto a normalizar son iguales (no se purga el sitio)", () => {
  const guardado = normalizeLayout({ ...DEFAULT_HOME_LAYOUT, templateId: "esmeralda", anchoPrincipal: "muyAncha" });
  assert.equal(mismoDiseno(comoEnLaBase(guardado), guardado), true);
  assert.equal(mismoDiseno(normalizeLayout(guardado), guardado), true);
});

test("un cambio de plantilla, de ancho o del cintillo cuenta como cambio", () => {
  const base = normalizeLayout({ ...DEFAULT_HOME_LAYOUT, templateId: "esmeralda" });
  assert.equal(mismoDiseno(base, { ...base, templateId: "clasico" }), false);
  assert.equal(mismoDiseno(base, { ...base, anchoPrincipal: base.anchoPrincipal === "normal" ? "ancha" : "normal" }), false);
  assert.equal(mismoDiseno(base, { ...base, ticker: { ...base.ticker, activo: !base.ticker?.activo } }), false);
});
