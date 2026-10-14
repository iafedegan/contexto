import test from "node:test";
import assert from "node:assert/strict";
import { LEGACY_SYSTEM_REDIRECTS, resolveLegacyTaxonomy } from "@/lib/redirects";

test("las secciones antiguas con mayúsculas en su nombre también redirigen", () => {
  assert.equal(resolveLegacyTaxonomy("/ColumnistasView/1"), "/categoria/columnistas");
  assert.equal(resolveLegacyTaxonomy("/RegionesView/ultNo"), "/categoria/regiones");
  assert.equal(resolveLegacyTaxonomy("/otrossistemP"), "/categoria/otros-sistemas-pecuarios");
  assert.equal(resolveLegacyTaxonomy("/IndicadoresView/IndicadorGanadero"), "/categoria/precio-del-ganado");
  assert.equal(resolveLegacyTaxonomy("/SeemoreNews/seemore"), "/");
});

test("las carpetas multimedia y de blogs del sitio anterior llevan a su categoría", () => {
  assert.equal(resolveLegacyTaxonomy("/galeria"), "/categoria/galeria");
  assert.equal(resolveLegacyTaxonomy("/video/"), "/categoria/video");
  assert.equal(resolveLegacyTaxonomy("/audio"), "/categoria/audio");
  assert.equal(resolveLegacyTaxonomy("/blog"), "/categoria/blogs");
  assert.equal(resolveLegacyTaxonomy("/seguridad"), "/categoria/seguridad");
  assert.equal(resolveLegacyTaxonomy("/otra-cosa"), null);
});

test("todas las claves de redirección de sistema están en minúscula (la búsqueda no distingue mayúsculas)", () => {
  for (const k of Object.keys(LEGACY_SYSTEM_REDIRECTS)) assert.equal(k, k.toLowerCase(), k);
  assert.equal(LEGACY_SYSTEM_REDIRECTS["/politicaempresarioview/quienessomos"], "/quienes-somos");
});
