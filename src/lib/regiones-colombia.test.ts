import test from "node:test";
import assert from "node:assert/strict";
import { DEPARTAMENTOS_FILTRO, REGIONES_COLOMBIA, departamentoPorSlug } from "@/lib/regiones-colombia";
import { DEPARTAMENTOS } from "@/lib/colombia-mapa";

test("cada departamento del mapa tiene su filtro y su región", () => {
  for (const d of DEPARTAMENTOS) {
    if (d.nombre === "BOGOTA, D.C.") continue; // se cuenta dentro de Cundinamarca
    const f = DEPARTAMENTOS_FILTRO.find((x) => x.mapa === d.nombre);
    assert.ok(f, `falta ${d.nombre}`);
    assert.ok(REGIONES_COLOMBIA.some((r) => r.slug === f!.region && r.departamentos.includes(d.nombre)), `región de ${d.nombre}`);
  }
});

test("los slugs de departamento son únicos y se resuelven", () => {
  const slugs = DEPARTAMENTOS_FILTRO.map((d) => d.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(departamentoPorSlug("norte-de-santander")?.nombre, "Norte de Santander");
  assert.equal(departamentoPorSlug("san-andres-y-providencia")?.region, "insular");
  assert.equal(departamentoPorSlug("no-existe"), undefined);
});
