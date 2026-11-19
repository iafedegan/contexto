import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { figuraImagen, pieConCredito, urlImagenValida } from "./figura-imagen";
import { sanitizeArticleHtml } from "@/lib/sanitize";

describe("figuraImagen", () => {
  it("el pie lleva el crédito al final", () => {
    assert.equal(pieConCredito("Vacunación en Arauca", "Foto: Ana Ruiz / FEDEGÁN"), "Vacunación en Arauca. Foto: Ana Ruiz / FEDEGÁN");
    assert.equal(pieConCredito("¿Quién vacuna?", "Archivo FEDEGÁN"), "¿Quién vacuna? Archivo FEDEGÁN");
    assert.equal(pieConCredito("  ", "Archivo FEDEGÁN"), "Archivo FEDEGÁN");
  });

  it("escapa lo que escribió la persona y sobrevive al sanitizador del sitio", () => {
    const html = figuraImagen({ url: "https://x.co/a.webp", alt: 'Vaca "cebú" <b>', pie: "Pie <script>", credito: "Foto: Ana / El Medio" });
    assert.doesNotMatch(html, /<script>|<b>/);
    const limpio = sanitizeArticleHtml(html);
    assert.match(limpio, /<figure><img src="https:\/\/x\.co\/a\.webp"/);
    assert.match(limpio, /<figcaption>Pie &lt;script&gt;\. Foto: Ana \/ El Medio<\/figcaption>/);
  });

  it("sin texto alternativo usa el pie", () => {
    assert.match(figuraImagen({ url: "https://x.co/a.webp", alt: "", pie: "Ganado en el Meta", credito: "Archivo FEDEGÁN" }), /alt="Ganado en el Meta"/);
  });

  it("solo direcciones https", () => {
    assert.equal(urlImagenValida("https://x.co/a.png"), true);
    assert.equal(urlImagenValida("http://x.co/a.png"), false);
    assert.equal(urlImagenValida("javascript:alert(1)"), false);
  });
});
