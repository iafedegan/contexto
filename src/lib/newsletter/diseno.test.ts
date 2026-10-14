import test from "node:test";
import assert from "node:assert/strict";
import { renderNewsletterHtml, renderNewsletterText, type NewsletterRender } from "@/lib/newsletter/template";
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
  assert.equal(d.plantilla, DEFAULT_NEWSLETTER_DESIGN.plantilla);
  assert.equal(d.colorPagina, DEFAULT_NEWSLETTER_DESIGN.colorPagina);
  assert.equal(d.franja, 4);
  assert.equal(d.boton, "pildora");
  assert.equal(d.botonTexto, DEFAULT_NEWSLETTER_DESIGN.botonTexto);
  assert.equal(d.mostrarLogo, false);
});

test("las nueve maquetaciones se dibujan con sus notas", () => {
  for (const plantilla of ["clasica", "editorial", "tarjetas", "numerada", "revista", "minima", "bloques", "mosaico", "dossier"]) {
    const h = render({ plantilla });
    for (const n of [1, 2, 3]) assert.match(h, new RegExp(`Titular ${n}`), `${plantilla} no muestra la nota ${n}`);
  }
  // «Mínima»: las demás notas van solo como titular (sin foto ni resumen).
  const minima = render({ plantilla: "minima" });
  assert.doesNotMatch(minima, /Resumen de la nota 2/);
  // «Revista» y «tarjetas»: todas con su resumen.
  assert.match(render({ plantilla: "revista" }), /Resumen de la nota 2/);
  assert.match(render({ plantilla: "tarjetas" }), /Resumen de la nota 2/);
  // «Numerada»: la lista lleva números grandes (02, 03…); «editorial» y «tarjetas» usan dos columnas que se apilan en móvil.
  assert.match(render({ plantilla: "numerada" }), />02</);
  assert.match(render({ plantilla: "editorial" }), /class="col"/);
  assert.match(render({ plantilla: "tarjetas" }), /class="col"/);
  // Las maquetaciones se distinguen de verdad entre sí.
  const todas = new Set(["clasica", "editorial", "tarjetas", "numerada", "revista", "minima", "bloques", "mosaico", "dossier"].map((p) => render({ plantilla: p })));
  assert.equal(todas.size, 9);
  // «Dossier»: recuadro «En breve» con las demás notas numeradas; «bloques» y «mosaico» se apilan en móvil igual que las rejillas.
  assert.match(render({ plantilla: "dossier" }), /En breve/);
  assert.match(render({ plantilla: "bloques" }), /class="col"/);
  assert.match(render({ plantilla: "mosaico" }), /class="col"/);
});

test("la cabecera: sencilla, en banda o gigante, con insignia de la edición", () => {
  assert.doesNotMatch(render({ masthead: "sencillo" }), /Edición N\.º 3<\/span>|border-radius:50%/);
  const banda = render({ masthead: "banda" });
  assert.match(banda, /Edición N\.º 3/);
  assert.match(banda, /border-radius:50%/); // insignia con el número
  const gigante = render({ masthead: "gigante", tipografia: "impacto" });
  assert.match(gigante, /Impact/);
  assert.match(gigante, /font:[^"]*60px/); // nombre del sitio en grande
  assert.doesNotMatch(render({ masthead: "gigante", insignia: false }), /border-radius:50%/);
  // La destacada sobre color usa el acento como fondo del panel.
  assert.match(render({ plantilla: "numerada", destacadaColor: true }), /padding:28px 32px 30px 32px;background:#/);
  assert.notEqual(render({ destacadaColor: true }), render({ destacadaColor: false }));
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

test("con secciones, cada una lleva su encabezado y sus notas en las nueve maquetaciones", () => {
  const n = (i: number) => nota(i, i === 3 ? null : `https://contexto.test/${i}.jpg`);
  const secciones = [
    { titulo: "Última hora", articulos: [n(1), n(2)] },
    { titulo: "Economía <ahora>", articulos: [n(3), n(4), n(5)] },
  ];
  const generar = (plantilla: string) =>
    renderNewsletterHtml({
      siteName: "CONtexto Ganadero",
      settings: sanitizeNewsletterSettings({ ...DEFAULT_NEWSLETTER_SETTINGS, design: { plantilla } }),
      subject: "Edición", preheader: "p", intro: "hola", issue: 3, unsubscribeUrl: "https://contexto.test/baja",
      articles: secciones.flatMap((s) => s.articulos), secciones,
    } as unknown as NewsletterRender);
  for (const plantilla of ["clasica", "editorial", "tarjetas", "numerada", "revista", "minima", "bloques", "mosaico", "dossier"]) {
    const h = generar(plantilla);
    assert.match(h, /Última hora/, `${plantilla}: falta el encabezado de la primera sección`);
    assert.match(h, /Economía &lt;ahora&gt;/, `${plantilla}: el título de la sección debe ir escapado`);
    assert.doesNotMatch(h, /Economía <ahora>/);
    for (const i of [1, 2, 3, 4, 5]) assert.match(h, new RegExp(`Titular ${i}\\b`), `${plantilla}: falta la nota ${i}`);
    assert.ok(h.indexOf("Última hora") < h.indexOf("Titular 1") && h.indexOf("Titular 2") < h.indexOf("Economía"), `${plantilla}: orden de las secciones`);
  }
  // Sin secciones el correo es el de siempre (sin encabezados añadidos).
  assert.doesNotMatch(render({ plantilla: "clasica" }), /Última hora/);
  // La versión en texto también separa por secciones y conserva una sola destacada.
  const texto = renderNewsletterText({
    siteName: "CONtexto Ganadero", settings: sanitizeNewsletterSettings(DEFAULT_NEWSLETTER_SETTINGS), subject: "E", preheader: "", intro: "", issue: 1, unsubscribeUrl: "https://contexto.test/baja",
    articles: secciones.flatMap((s) => s.articulos), secciones,
  } as unknown as NewsletterRender);
  assert.match(texto, /ÚLTIMA HORA\n\n.*DESTACADA/);
  assert.match(texto, /ECONOMÍA <AHORA>/);
  assert.equal((texto.match(/DESTACADA/g) ?? []).length, 1);
});
