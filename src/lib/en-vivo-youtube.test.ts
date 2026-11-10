import test from "node:test";
import assert from "node:assert/strict";
import { leerPaginaLive } from "@/lib/en-vivo-youtube";
import { normalizarCanal, sanitizeEnVivo } from "@/lib/en-vivo-types";

const pagina = (extra: string) => `<html><head><meta name="title" content="🔴 EN VIVO: Asamblea &amp; foro"></head><body><script>var x={"videoDetails":{"videoId":"27K7y7Ejw1o","title":"x"},${extra}}</script></body></html>`;

test("canal en vivo: video y título", () => {
  const r = leerPaginaLive(pagina(`"liveBroadcastDetails":{"isLiveNow":true,"startTimestamp":"2026-11-01T17:08:26+00:00"}`));
  assert.deepEqual(r, { estado: "vivo", videoId: "27K7y7Ejw1o", titulo: "🔴 EN VIVO: Asamblea & foro" });
});

test("directo programado a futuro: programado, no vivo", () => {
  const en1h = Math.round(Date.now() / 1000) + 3600;
  const r = leerPaginaLive(pagina(`"liveBroadcastDetails":{"isLiveNow":false},"isUpcoming":true,"scheduledStartTime":"${en1h}"`));
  assert.equal(r.estado, "programado");
});

test("anuncio de directo viejo (programado hace un año) o canal sin video: sin transmisión", () => {
  assert.equal(leerPaginaLive(pagina(`"liveBroadcastDetails":{"isLiveNow":false},"isUpcoming":true,"scheduledStartTime":"1761059460"`)).estado, "sin");
  assert.equal(leerPaginaLive("<html><body>canal sin directo</body></html>").estado, "sin");
});

test("normalizarCanal acepta enlace, @usuario e id UC…", () => {
  assert.equal(normalizarCanal("https://www.youtube.com/@ContextoGanadero"), "@ContextoGanadero");
  assert.equal(normalizarCanal("@ContextoGanadero"), "@ContextoGanadero");
  assert.equal(normalizarCanal("https://www.youtube.com/channel/UCqqtjzE_6oXZvAuJtKLgoCQ"), "channel/UCqqtjzE_6oXZvAuJtKLgoCQ");
  assert.equal(normalizarCanal("javascript:alert(1)"), "");
});

test("sanitizeEnVivo: valores viejos sin modo automático siguen funcionando", () => {
  const c = sanitizeEnVivo({ activo: true, url: "https://www.youtube.com/watch?v=27K7y7Ejw1o", titulo: "x" });
  assert.equal(c.activo, true);
  assert.equal(c.auto, false);
  assert.equal(c.origen, "manual");
  assert.equal(c.canal, "@ContextoGanadero");
});
