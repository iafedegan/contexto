import test from "node:test";
import assert from "node:assert/strict";
import { AI_TRAINING_BOTS, HERRAMIENTAS_PERMITIDAS, isBlockedBot } from "@/lib/bots";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

test("los crawlers de entrenamiento de IA y los copiadores de sitios se rechazan por su nombre", () => {
  assert.equal(isBlockedBot("Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.1; +https://openai.com/gptbot)"), true);
  assert.equal(isBlockedBot("CCBot/2.0 (https://commoncrawl.org/faq/)"), true);
  assert.equal(isBlockedBot("HTTrack/3.0"), true);
  assert.equal(isBlockedBot("Scrapy/2.11 (+https://scrapy.org)"), true);
  for (const b of AI_TRAINING_BOTS) assert.equal(isBlockedBot(`x ${b}/1.0 y`), true, b);
});

test("un lector, un buscador y un buscador de IA que enlaza pasan", () => {
  assert.equal(isBlockedBot(CHROME), false);
  assert.equal(isBlockedBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), false);
  assert.equal(isBlockedBot("Mozilla/5.0 (compatible; PerplexityBot/1.0)"), false);
});

test("lo que bloqueaba antes y rompía auditorías, monitores y pruebas ya no se bloquea (H-13)", () => {
  for (const ua of [
    "", // sin User-Agent
    "curl/8.7.1",
    "python-requests/2.32.3",
    "Go-http-client/2.0",
    "axios/1.7.2",
    "node-fetch/1.0",
    "Mozilla/5.0 ... HeadlessChrome/130.0 Safari/537.36",
    "Mozilla/5.0 ... Playwright/1.48",
    "Java/17.0.2",
  ]) {
    assert.equal(isBlockedBot(ua), false, `«${ua}» debe pasar`);
  }
  assert.equal(isBlockedBot(null), false);
});

test("las herramientas de auditoría y monitoreo documentadas nunca se bloquean, ni siquiera con un token de copiador", () => {
  assert.equal(isBlockedBot("Mozilla/5.0 (Linux; Android 11) Chrome/130 Mobile Safari/537.36 Chrome-Lighthouse"), false);
  assert.equal(isBlockedBot("Mozilla/5.0 HeadlessChrome/130 Lighthouse"), false);
  assert.equal(isBlockedBot("UptimeRobot/2.0; http://www.uptimerobot.com/"), false);
  assert.equal(isBlockedBot("Datadog/Synthetics scrapy"), false, "gana lo permitido de forma explícita");
  assert.equal(isBlockedBot("W3C_Validator/1.3"), false);
  assert.equal(isBlockedBot("Feedly/1.0 (+http://www.feedly.com/fetcher.html)"), false);
  assert.equal(isBlockedBot("ContextoGanadero-Monitor/1.0 python-requests"), false);
  assert.ok(HERRAMIENTAS_PERMITIDAS.length >= 5);
});

test("BOT_ALLOW_EXTRA y BOT_BLOCK_EXTRA permiten reaccionar sin desplegar código", () => {
  assert.equal(isBlockedBot("MiMonitorInterno/1.0 httrack", { BOT_ALLOW_EXTRA: "mimonitorinterno" }), false);
  assert.equal(isBlockedBot("BadBot/9.9", {}), false);
  assert.equal(isBlockedBot("BadBot/9.9", { BOT_BLOCK_EXTRA: "badbot, otro-malo" }), true);
  assert.equal(isBlockedBot(CHROME, { BOT_BLOCK_EXTRA: "ab" }), false, "fragmentos de menos de 3 letras se ignoran: evitan bloquear a todos por error");
});
