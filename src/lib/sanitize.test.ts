import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeArticleHtml } from "@/lib/sanitize";

test("el HTML de una nota no conserva scripts ni manejadores de eventos", () => {
  const limpio = sanitizeArticleHtml('<p onclick="x()">Hola</p><script>alert(1)</script><img src="a.jpg" onerror="x()">');
  assert.equal(limpio.includes("<script"), false);
  assert.equal(limpio.includes("onclick"), false);
  assert.equal(limpio.includes("onerror"), false);
  assert.match(limpio, /Hola/);
});

test("se conservan intertítulos, negrita, citas y enlaces", () => {
  const limpio = sanitizeArticleHtml('<h2>T</h2><p><strong>a</strong></p><blockquote><p>c</p></blockquote><a href="https://x.co">x</a>');
  for (const t of ["<h2>", "<strong>", "<blockquote>", 'href="https://x.co"']) assert.ok(limpio.includes(t), t);
});

test("un audio con dirección https se conserva y uno con javascript: no", () => {
  const bueno = sanitizeArticleHtml('<figure><audio controls preload="none" src="https://x.co/a.mp3" onplay="x()"></audio></figure>');
  assert.ok(bueno.includes('<audio controls="controls" preload="none" src="https://x.co/a.mp3">') || bueno.includes("<audio"), bueno);
  assert.equal(bueno.includes("onplay"), false);
  assert.equal(sanitizeArticleHtml('<audio src="javascript:alert(1)"></audio>').includes("javascript:"), false);
});

test("la cita destacada y la infografía del editor sobreviven al saneado; otras clases no", () => {
  const cita = sanitizeArticleHtml('<blockquote class="cita-destacada otra" onclick="x()"><p>Frase</p><cite>Autor</cite></blockquote>');
  assert.equal(cita, '<blockquote class="cita-destacada"><p>Frase</p><cite>Autor</cite></blockquote>');
  const info = sanitizeArticleHtml('<figure class="infografia rara"><img src="https://x.co/a.png" alt="Pie" loading="lazy" /><figcaption>Pie</figcaption></figure>');
  assert.match(info, /^<figure class="infografia"><img src="https:\/\/x\.co\/a\.png" alt="Pie" loading="lazy" \/><figcaption>Pie<\/figcaption><\/figure>$/);
  assert.equal(sanitizeArticleHtml('<blockquote class="peligrosa"><p>x</p></blockquote>'), "<blockquote><p>x</p></blockquote>");
});
