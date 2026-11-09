import test from "node:test";
import assert from "node:assert/strict";
import { renderNewsletterHtml, type NewsletterRender } from "@/lib/newsletter/template";
import { renderConfirmationHtml } from "@/lib/newsletter/confirm-html";
import { ORO, partirMarca } from "@/lib/newsletter/deluxe";
import { DEFAULT_NEWSLETTER_SETTINGS, sanitizeNewsletterDesign, sanitizeNewsletterSettings } from "@/lib/newsletter/types";

const nota = (n: number, foto: string | null) => ({
  slug: `nota-${n}`, title: `Titular ${n}`, excerpt: `Resumen de la nota ${n}`, coverImageUrl: foto, categoryName: "Ganadería", authorName: "Ana", publishedAt: new Date("2026-10-01T12:00:00Z"),
});
const GALA = { plantilla: "gala", masthead: "gala", colorPagina: "#0a1f19", colorTarjeta: "#fbf8f1", colorTitulos: "#10261e", esquinas: "rectas", boton: "recto", cierre: "Gracias por leernos." };
const render = (design: unknown, extra: object = {}) =>
  renderNewsletterHtml({
    siteName: "CONtexto Ganadero Media",
    settings: sanitizeNewsletterSettings({ ...DEFAULT_NEWSLETTER_SETTINGS, accentColor: "#8c6a2f", design }),
    subject: "Edición", preheader: "p", intro: "hola", issue: 3, unsubscribeUrl: "https://contexto.test/baja",
    articles: [nota(1, "https://contexto.test/a.jpg"), nota(2, "https://contexto.test/b.jpg"), nota(3, null)],
    ...extra,
  } as unknown as NewsletterRender);

test("la marca se parte en «CONtexto Ganadero» y «Media»; otro nombre queda entero", () => {
  assert.deepEqual(partirMarca("CONtexto Ganadero Media"), { principal: "CONtexto Ganadero", sub: "Media" });
  assert.deepEqual(partirMarca("  CONtexto   Ganadero  MEDIA "), { principal: "CONtexto Ganadero", sub: "MEDIA" });
  assert.deepEqual(partirMarca("Otra Marca"), { principal: "Otra Marca", sub: "" });
  assert.deepEqual(partirMarca("Media"), { principal: "Media", sub: "" });
});

test("el diseño acepta «gala» y lo desconocido sigue volviendo al de siempre", () => {
  const d = sanitizeNewsletterDesign({ plantilla: "gala", masthead: "gala" });
  assert.equal(d.plantilla, "gala");
  assert.equal(d.masthead, "gala");
  assert.equal(sanitizeNewsletterDesign({ plantilla: "lujo" }).plantilla, "editorial");
});

test("el correo de gala lleva la cabecera de marca, el oro, todas las notas y el cierre centrado", () => {
  const h = render(GALA);
  assert.match(h, />CONtexto Ganadero</, "marca principal");
  assert.match(h, />Media</, "«Media» aparte");
  assert.ok(h.includes(ORO), "usa el oro");
  for (const n of [1, 2, 3]) assert.match(h, new RegExp(`Titular ${n}`));
  assert.match(h, /También en esta edición/);
  assert.match(h, /Gracias por leernos/);
  assert.doesNotMatch(h, /undefined|NaN|\[object/);
  // Las filas de notas alternan la foto de lado y se apilan en móvil.
  assert.match(h, /class="col"/);
});

test("el pie es legible sobre una página oscura y no cambia en las paletas claras", () => {
  assert.doesNotMatch(render(GALA).split('class="legal"')[1], /#7d746a/);
  assert.match(render({}).split('class="legal"')[1], /#7d746a/);
});

test("«gala» funciona con encabezados de sección, con una sola nota y sin fotos", () => {
  const secs = render(GALA, { secciones: [{ titulo: null, articulos: [nota(1, null), nota(2, null)] }, { titulo: "Colombia", articulos: [nota(3, null)] }] });
  assert.match(secs, /Colombia/);
  assert.match(secs, /Titular 3/);
  const una = render(GALA, { articles: [nota(1, null)] });
  assert.match(una, /Titular 1/);
  assert.doesNotMatch(una, /También en esta edición/);
});

test("el texto del usuario se escapa también en «gala»", () => {
  const h = render(GALA, { subject: '<script>alert(1)</script>', intro: '<img src=x onerror=1>' });
  assert.doesNotMatch(h, /<script>alert/);
  assert.doesNotMatch(h, /<img src=x/);
});

test("el correo de confirmación es de marca, escapa los datos y lleva el enlace", () => {
  const h = renderConfirmationHtml({ nombre: "CONtexto Ganadero Media", tagline: "Periodismo del sector ganadero", email: "a<b>@x.co", url: "https://sitio.test/boletin/confirmar?t=abc&x=1" });
  assert.match(h, />CONtexto Ganadero</);
  assert.match(h, />Media</);
  assert.match(h, /Confirma tu suscripción/);
  assert.match(h, /href="https:\/\/sitio\.test\/boletin\/confirmar\?t=abc&amp;x=1"/);
  assert.doesNotMatch(h, /a<b>@x\.co/);
  assert.match(h, /a&lt;b&gt;@x\.co/);
  assert.ok(h.includes(ORO));
});
