import test from "node:test";
import assert from "node:assert/strict";
import { clasificarFuente } from "@/lib/fuente-lectura";

const host = "contexto-olive.vercel.app";

test("el enlace de un feed (utm_source=rss) se cuenta como lector RSS", () => {
  assert.equal(clasificarFuente({ utmSource: "rss", utmMedium: "feed", utmCampaign: "general", host }), "Lector RSS");
});

test("si además llega desde Feedly se nombra el lector", () => {
  assert.equal(clasificarFuente({ utmSource: "rss", utmMedium: "feed", referrer: "https://feedly.com/", host }), "Lector RSS · Feedly");
  assert.equal(clasificarFuente({ referrer: "https://app.inoreader.com/feed/x", host }), "Lector RSS · Inoreader");
});

test("un lector conocido sin UTM también se reconoce", () => {
  assert.equal(clasificarFuente({ referrer: "https://www.feedly.com/i/entry/abc", host }), "Lector RSS · Feedly");
});

test("las demás campañas siguen apareciendo como UTM, con su medio y campaña", () => {
  assert.equal(clasificarFuente({ utmSource: "push", utmMedium: "notificacion", utmCampaign: "ultima-hora", host }), "UTM · push / notificacion / ultima-hora");
});

test("buscadores, redes, interno y directo", () => {
  assert.equal(clasificarFuente({ referrer: "https://www.google.com/", host }), "Google");
  assert.equal(clasificarFuente({ referrer: "https://l.facebook.com/l.php", host }), "Facebook");
  assert.equal(clasificarFuente({ referrer: `https://${host}/categoria/ganaderia`, host }), "Interno (otras páginas del sitio)");
  assert.equal(clasificarFuente({ host }), "Directo");
});
