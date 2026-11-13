import { test } from "node:test";
import assert from "node:assert/strict";
import { embedDeCodigo, incrustarCodigoPegado, incrustarEnlaces, parseEmbed } from "./embeds";

const CODIGO_X =
  '<blockquote class="twitter-tweet"><p lang="es" dir="ltr">¡Bienvenida sea la auditoría!</p>&mdash; José Félix Lafaurie (@jflafaurie) <a href="https://x.com/jflafaurie/status/2119773248007045544?ref_src=twsrc%5Etfw">November 9, 2026</a></blockquote> <script async src="https://platform.x.com/widgets.js" charset="utf-8"></script>';

test("reconoce enlaces de redes sociales", () => {
  assert.equal(parseEmbed("https://x.com/jflafaurie/status/2119773248007045544?ref_src=twsrc%5Etfw")?.tipo, "x");
  assert.equal(parseEmbed("https://www.instagram.com/p/CxYz123AbC/")?.tipo, "instagram");
  assert.equal(parseEmbed("https://www.tiktok.com/@usuario/video/7234567890123456789")?.tipo, "tiktok");
  assert.equal(parseEmbed("https://www.youtube.com/live/_FGEH8PtcvI?si=uE8_7Mg98kyZPjNF")?.tipo, "youtube");
  assert.equal(parseEmbed("https://ejemplo.com/algo"), null);
});

test("el código de incrustación de X pegado se vuelve la publicación", () => {
  assert.equal(embedDeCodigo(CODIGO_X)?.tipo, "x");
});

test("el código de X que quedó como texto en la nota se reemplaza por la publicación", () => {
  const escapado = CODIGO_X.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<p>Antes</p><p>${escapado}</p><p>Después</p>`;
  const r = incrustarCodigoPegado(html);
  assert.match(r, /platform\.twitter\.com\/embed\/Tweet\.html\?id=2119773248007045544/);
  assert.doesNotMatch(r, /twitter-tweet|widgets\.js/);
  assert.match(r, /<p>Antes<\/p>/);
  assert.match(r, /<p>Después<\/p>/);
});

test("un párrafo con solo el enlace de YouTube se incrusta", () => {
  const r = incrustarEnlaces('<p><a href="https://www.youtube.com/live/_FGEH8PtcvI?si=x">https://www.youtube.com/live/_FGEH8PtcvI?si=x</a></p>');
  assert.match(r, /youtube-nocookie\.com\/embed\/_FGEH8PtcvI/);
});
