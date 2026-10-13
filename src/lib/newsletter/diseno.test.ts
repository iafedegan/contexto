import test from "node:test";
import assert from "node:assert/strict";
import { renderNewsletterHtml, type NewsletterRender } from "@/lib/newsletter/template";
import { DEFAULT_NEWSLETTER_DESIGN, DEFAULT_NEWSLETTER_SETTINGS, sanitizeNewsletterDesign, sanitizeNewsletterSettings } from "@/lib/newsletter/types";

const nota = (n: number, foto: string | null) => ({
  slug: `nota-${n}`, title: `Titular ${n}`, excerpt: `Resumen de la nota ${n}`, coverImageUrl: foto, categoryName: "Ganadería", authorName: "Ana Gómez", publishedAt: new Date("2026-10-01T12:00:00Z"),
});
const render = (design: unknown): string =>
  renderNewsletterHtml({
    siteName: "CONtexto Ganadero",
    settings: sanitizeNewsletterSettings({ ...DEFAULT_NEWSLETTER_SETTINGS, design }),
    subject: "Edición", preheader: "p", intro: "hola", issue: 3, unsubscribeUrl: "https://contexto.test/baja",
    articles: [nota(1, "https://contexto.test/a.jpg"), nota(2, "https://contexto.test/b.jpg"), nota(3, null)],
  } as unknown as NewsletterRender);

test("el diseño inválido o ausente vuelve al diseño de siempre", () => {
  assert.deepEqual(sanitizeNewsletterDesign(undefined), DEFAULT_NEWSLETTER_DESIGN);
  const d = sanitizeNewsletterDesign({ plantilla: "otra", colorPagina: "rojo", franja: 99, boton: "x", botonTexto: "  ", mostrarLogo: "sí" });
  assert.equal(d.plantilla, "clasica");
  assert.equal(d.colorPagina, DEFAULT_NEWSLETTER_DESIGN.colorPagina);
  assert.equal(d.franja, 4);
  assert.equal(d.boton, "pildora");
  assert.equal(d.botonTexto, DEFAULT_NEWSLETTER_DESIGN.botonTexto);
  assert.equal(d.mostrarLogo, false);
});

test("las cuatro maquetaciones se dibujan con sus notas", () => {
  for (const plantilla of ["clasica", "revista", "compacta", "minima"]) {
    const h = render({ plantilla });
    for (const n of [1, 2, 3]) assert.match(h, new RegExp(`Titular ${n}`), `${plantilla} no muestra la nota ${n}`);
  }
  // «Mínima»: las demás notas van solo como titular (sin foto ni resumen).
  const minima = render({ plantilla: "minima" });
  assert.doesNotMatch(minima, /Resumen de la nota 2/);
  // «Revista»: todas con su resumen.
  assert.match(render({ plantilla: "revista" }), /Resumen de la nota 2/);
});

test("los colores, el botón y lo que se muestra siguen el diseño", () => {
  const h = render({ colorPagina: "#112233", colorTarjeta: "#445566", botonTexto: "Leer más", boton: "recto", mostrarAutor: true, mostrarLogo: true, franja: 0, cierre: "Hasta la próxima" });
  assert.match(h, /background:#112233/);
  assert.match(h, /background:#445566/);
  assert.match(h, /Leer más/);
  assert.match(h, /border-radius:0/);
  assert.match(h, /Por Ana Gómez/);
  assert.match(h, /contexto-ganadero-logo-v3-512\.png/);
  assert.match(h, /Hasta la próxima/);
  assert.doesNotMatch(h, /border-top:\d+px solid/);
  assert.doesNotMatch(render({}), /Por Ana Gómez/);
});
