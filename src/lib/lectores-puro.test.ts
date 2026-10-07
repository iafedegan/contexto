import test from "node:test";
import assert from "node:assert/strict";
import { perfilDeUa } from "@/lib/lectores-ua";
import { departamentoDeRegion, nombreDeDepartamento } from "@/lib/lectores-geo";
import { aParametros, filtrosActivos, hoyColombia, leerFiltros, periodoAnterior } from "@/lib/lectores-filtros";
import { validarInicio, validarProgreso, validarVinculo } from "@/lib/lectores-entrada";

const AHORA = new Date("2026-10-07T03:00:00Z"); // 6 de octubre, 22:00 en Colombia

test("el dispositivo se clasifica con lo grueso: celular, tableta o computador", () => {
  assert.equal(perfilDeUa("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1").device, "mobile");
  assert.equal(perfilDeUa("Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1").device, "tablet");
  assert.equal(perfilDeUa("Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130 Safari/537.36").device, "tablet", "Android sin «Mobile» es tableta");
  assert.equal(perfilDeUa("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36").device, "mobile");
  assert.equal(perfilDeUa("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36").device, "desktop");
});

test("el navegador y el sistema respetan el orden (Edge y Opera dicen «Chrome»; Chrome dice «Safari»)", () => {
  assert.deepEqual(perfilDeUa("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36 Edg/130").browser, "Edge");
  assert.equal(perfilDeUa("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36").browser, "Chrome");
  assert.equal(perfilDeUa("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15").browser, "Safari");
  assert.equal(perfilDeUa("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) CriOS/130 Mobile/15E148").browser, "Chrome");
  assert.equal(perfilDeUa("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0").os, "Windows");
});

test("los robots y lo vacío no se hacen pasar por lectores", () => {
  assert.equal(perfilDeUa("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)").browser, "Robot");
  assert.equal(perfilDeUa("HeadlessChrome/130").browser, "Robot");
  assert.deepEqual(perfilDeUa(""), { device: "otro", browser: "Otro", os: "Otro" });
  assert.deepEqual(perfilDeUa(null), { device: "otro", browser: "Otro", os: "Otro" });
});

test("los códigos de región de Vercel se vuelven departamentos del mapa", () => {
  assert.equal(departamentoDeRegion("ANT"), "ANTIOQUIA");
  assert.equal(departamentoDeRegion("DC"), "BOGOTA DC");
  assert.equal(departamentoDeRegion("co-nsa"), "NORTE DE SANTANDER");
  assert.equal(departamentoDeRegion("XX"), null);
  assert.equal(departamentoDeRegion(null), null);
  assert.equal(nombreDeDepartamento("NORTE DE SANTANDER"), "Norte de Santander");
  assert.equal(nombreDeDepartamento("VALLE DEL CAUCA"), "Valle del Cauca");
  assert.equal(nombreDeDepartamento("BOGOTA DC"), "Bogotá D.C.");
});

test("sin parámetros el rango son los últimos 30 días hasta hoy en Colombia", () => {
  assert.equal(hoyColombia(AHORA), "2026-10-06");
  const f = leerFiltros({}, AHORA);
  assert.deepEqual([f.desde, f.hasta], ["2026-09-07", "2026-10-06"]);
  assert.equal(filtrosActivos(f), 0);
});

test("los filtros se validan: fechas malas, futuras o invertidas y valores fuera de lista se descartan", () => {
  const f = leerFiltros({ desde: "2026-10-30", hasta: "2027-01-01", dispositivo: "nevera", visitante: "nuevo", ciudad: "  Bogotá  ", fuente: ["Google", "x"] }, AHORA);
  assert.equal(f.hasta, "2026-10-06", "no se mide el futuro");
  assert.equal(f.desde, "2026-10-06", "desde no puede pasar de hasta");
  assert.equal(f.dispositivo, undefined);
  assert.equal(f.visitante, "nuevo");
  assert.equal(f.ciudad, "Bogotá");
  assert.equal(f.fuente, "Google");
  assert.equal(filtrosActivos(f), 3);
  assert.equal(leerFiltros({ desde: "basura" }, AHORA).desde, "2026-09-07");
  assert.equal(leerFiltros({ desde: "2020-01-01", hasta: "2026-10-06" }, AHORA).desde, "2024-10-06", "máximo dos años");
});

test("el periodo anterior tiene la misma duración y termina el día antes", () => {
  assert.deepEqual(periodoAnterior({ desde: "2026-09-07", hasta: "2026-10-06" }), { desde: "2026-08-08", hasta: "2026-09-06", dias: 30 });
  assert.deepEqual(periodoAnterior({ desde: "2026-10-06", hasta: "2026-10-06" }), { desde: "2026-10-05", hasta: "2026-10-05", dias: 1 });
});

test("a la dirección solo pasan los filtros con valor", () => {
  assert.equal(aParametros({ desde: "2026-09-07", hasta: "2026-10-06", ciudad: undefined, dispositivo: "mobile" }).toString(), "desde=2026-09-07&hasta=2026-10-06&dispositivo=mobile");
});

const VID = "3f2b8c1e-5a4d-4e7b-9c0a-1d2e3f4a5b6c";
test("el inicio de lectura exige un visitante con forma de UUID y una nota", () => {
  assert.equal(validarInicio({ vid: "no-soy-uuid", slug: "x" }), null);
  assert.equal(validarInicio({ vid: VID, slug: "" }), null);
  assert.equal(validarInicio(null), null);
  const ok = validarInicio({ vid: VID.toUpperCase(), slug: "mi-nota", ret: true, us: "boletin", ref: "https://www.google.com/" });
  assert.equal(ok?.visitante, VID);
  assert.equal(ok?.recurrente, true);
  assert.equal(ok?.utm.utmSource, "boletin");
  assert.equal(validarInicio({ vid: VID, slug: "x".repeat(500) })?.slug.length, 200);
});

test("el avance se acota: scroll de 0 a 100 y hasta una hora de lectura", () => {
  const id = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
  assert.deepEqual(validarProgreso({ vid: VID, id, sc: 250, s: 99999 }), { visitante: VID, lectura: id, scroll: 100, segundos: 3600 });
  assert.deepEqual(validarProgreso({ vid: VID, id, sc: -5, s: "abc" }), { visitante: VID, lectura: id, scroll: 0, segundos: 0 });
  assert.equal(validarProgreso({ vid: VID, id: "x", sc: 10, s: 10 }), null);
});

test("el vínculo por el enlace del boletín exige visitante, suscriptor y una firma de largo razonable", () => {
  const SUB = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
  assert.deepEqual(validarVinculo({ vid: VID, s: SUB, t: "a".repeat(32) }), { visitante: VID, suscriptor: SUB, firma: "a".repeat(32) });
  assert.equal(validarVinculo({ vid: VID, s: SUB, t: "corta" }), null);
  assert.equal(validarVinculo({ vid: VID, s: "no-uuid", t: "a".repeat(32) }), null);
  assert.equal(validarVinculo({ vid: "x", s: SUB, t: "a".repeat(32) }), null);
  assert.equal(validarVinculo(null), null);
});
