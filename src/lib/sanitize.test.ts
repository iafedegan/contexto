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
