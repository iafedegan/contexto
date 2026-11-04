import test from "node:test";
import assert from "node:assert/strict";
import { esNavegadorIncrustado } from "@/lib/navegador-incrustado";

const casos: Array<[string, string, boolean]> = [
  ["Safari en iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1", false],
  ["Chrome en iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1", false],
  ["app con navegador incrustado en iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148", true],
  ["Facebook en iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.38.109]", false],
  ["Instagram en iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 355.0.0.37.103", false],
  ["Chrome en Android", "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", false],
  ["app con navegador incrustado en Android", "Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36", true],
  ["WhatsApp en Android", "Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 WhatsApp/2.24", false],
  ["computador", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", false],
  ["sin identificación", "", false],
];

test("reconoce el navegador incrustado de una app y deja fuera navegadores completos y redes sociales", () => {
  for (const [nombre, ua, esperado] of casos) assert.equal(esNavegadorIncrustado(ua), esperado, nombre);
});
