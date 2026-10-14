import test from "node:test";
import assert from "node:assert/strict";
import { elegirCategoria, aCategoria, type Arbol } from "./migracion/categorias";
import { extraerNota, direccionesDeMapa } from "./migracion/extraer";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import type { NotaDescargada } from "./migracion/extraer";
import { altDePortada, aTextoPlano, camposBasicos, bloquesMultimedia, construirCuerpo, decodificarEntidades, limpiarHtmlAntiguo, normalizarSlug, pieDeFoto, sinResumenRepetido, urlBaseImagen, type Contexto } from "./migracion/transformar";

// Contexto de prueba: las imágenes se «copian» a otro dominio y las notas conocidas se reescriben.
const ctx: Contexto = {
  imagen: (u) => u.replace("https://a.storyblok.com/", "https://copia.test/"),
  enlace: (r) => (r === "/regiones/otra-nota" ? "/articulo/otra-nota" : null),
};

test("normalizarSlug deja solo minúsculas, números y guiones, sin guiones en los bordes", () => {
  assert.equal(normalizarSlug("Que-Lacteos-Son-Mejores-"), "que-lacteos-son-mejores");
  assert.equal(normalizarSlug("--abc--def"), "abc-def");
  assert.equal(normalizarSlug("Año: Niño/ñandú"), "ano-nino-nandu");
  assert.equal(normalizarSlug("che", "123456"), "che-123456");
  assert.ok(normalizarSlug("a".repeat(400) + "-fin").length <= 220);
  assert.match(normalizarSlug("a-b--c"), /^[a-z0-9][a-z0-9-]{3,220}$/);
});

test("decodificarEntidades y aTextoPlano devuelven texto legible", () => {
  assert.equal(decodificarEntidades("Ni&#xF1;o &amp; &quot;caf&eacute;&quot; &#39;x&#39;"), "Niño & \"café\" 'x'");
  assert.equal(aTextoPlano("<p>Hola <strong>mundo</strong></p><p>otra &amp; línea</p>"), "Hola mundo otra & línea");
});

test("urlBaseImagen quita las transformaciones de Storyblok", () => {
  assert.equal(urlBaseImagen("https://a.storyblok.com/f/160385/1535x1024/bb4efb83e6/imagen-1.webp/m/filters:quality(70)/"), "https://a.storyblok.com/f/160385/1535x1024/bb4efb83e6/imagen-1.webp");
  assert.equal(urlBaseImagen("//a.storyblok.com/f/1/2/x.jpg?cv=1"), "https://a.storyblok.com/f/1/2/x.jpg");
});

test("las incrustaciones de redes se vuelven enlaces y los scripts desaparecen", () => {
  const h = limpiarHtmlAntiguo(
    [
      '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/reel/ABC/?utm_source=ig_embed" style="x"><div style="padding:16px;">basura</div></blockquote>',
      '<script async src="//www.instagram.com/embed.js"></script>',
      '<iframe src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fweb.facebook.com%2FAlcaldia%2Fposts%2F123&show_text=true" width="500"></iframe>',
      '<iframe width="560" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Un video"></iframe>',
      '<blockquote class="twitter-tweet"><p>Texto del trino</p>— Alguien <a href="https://x.com/a/status/1">fecha</a></blockquote><script async src="https://platform.x.com/widgets.js"></script>',
    ].join("\n"),
    ctx,
  );
  assert.ok(h.includes('href="https://www.instagram.com/reel/ABC/"'), h);
  assert.ok(h.includes('href="https://www.facebook.com/Alcaldia/posts/123"'), h);
  assert.ok(h.includes("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"), h);
  assert.ok(h.includes("Texto del trino"), h);
  assert.equal(/<script|basura|instgrm/.test(h), false, h);
});

test("SoundCloud y los contenidos propios se dejan incrustados; los demás marcos pasan a enlace", () => {
  const h = limpiarHtmlAntiguo(
    [
      '<iframe frameborder="no" height="166" scrolling="no" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/249072847&amp;color=ff5500" width="100%"></iframe>',
      '<iframe height="950" src="https://static.contextoganadero.com/diccionario/diccionario_base.html" width="633"></iframe>',
      '<iframe height="400" src="https://drive.google.com/file/d/ABC/preview" width="640"></iframe>',
    ].join("\n"),
    ctx,
  );
  assert.ok(h.includes("w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/249072847") && h.includes('height="166"'), h);
  assert.ok(h.includes("https://static.contextoganadero.com/diccionario/diccionario_base.html") && h.includes('height="950"'), h);
  assert.ok(h.includes('<a href="https://drive.google.com/file/d/ABC/preview"'), h);
});

test("el saneador deja pasar el reproductor de SoundCloud y quita marcos de dominios no admitidos", () => {
  const limpio = sanitizeArticleHtml('<figure class="lx-embed"><iframe src="https://w.soundcloud.com/player/?url=x" height="166" loading="lazy"></iframe></figure><iframe src="https://evil.example/x"></iframe>');
  assert.ok(limpio.includes("w.soundcloud.com/player"), limpio);
  assert.equal(limpio.includes("evil.example"), false);
});

test("el HTML suelto que algunas notas dejaron dentro de un marco se descarta y no se escapa como texto", () => {
  const entrada = '<p>Antes</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560"></figure>\n\n<p></br></p></iframe><p>Después</p>';
  const salida = limpiarHtmlAntiguo(entrada, ctx);
  assert.ok(salida.includes("youtube-nocookie.com/embed/dQw4w9WgXcQ"), salida);
  assert.equal(/&lt;|<\/br>|<\/figure><p>/.test(salida.replace(/<figure class="lx-embed">[\s\S]*?<\/figure>/, "")), false, salida);
  const limpio = construirCuerpo({ path: "/x/y", status: 200, ld: null, story: { id: 1, uuid: "u", name: "n", slug: "y", full_slug: "x/y", created_at: null, first_published_at: null, published_at: null, updated_at: null, tag_list: [], content: { body: { html: entrada } } } }, "", ctx);
  assert.equal(limpio.includes("&lt;"), false, limpio);
  assert.match(limpio, /Antes[\s\S]*youtube-nocookie[\s\S]*Después/);
});

test("un enlace a la foto completa en Storyblok apunta a la copia y las direcciones con barra de más se arreglan", () => {
  const h = limpiarHtmlAntiguo('<a href="https://a.storyblok.com/f/1/2/foto.jpg"><img src="https://a.storyblok.com/f/1/2/foto.jpg"></a><img src="https:///a.storyblok.com/f/1/3/otra.jpg">', ctx);
  assert.equal((h.match(/https:\/\/copia\.test\/f\/1\/2\/foto\.jpg/g) ?? []).length, 2, h);
  assert.ok(h.includes("https://copia.test/f/1/3/otra.jpg"), h);
  assert.equal(urlBaseImagen("https:///a.storyblok.com/f/1/3/otra.jpg"), "https://a.storyblok.com/f/1/3/otra.jpg");
});

test("las imágenes se sustituyen por su copia y los enlaces a otras notas pasan a la dirección nueva", () => {
  const h = limpiarHtmlAntiguo(
    '<p><img src="https://a.storyblok.com/f/1/2/x.jpg/m/" alt="Una vaca" width="10"> <a href="https://www.contextoganadero.com/regiones/otra-nota">otra</a> <a href="https://www.contextoganadero.com/regiones/desconocida">x</a> <a href="https://externo.com/a">e</a></p><p><br></p>',
    ctx,
  );
  assert.ok(h.includes('src="https://copia.test/f/1/2/x.jpg"'), h);
  assert.ok(h.includes('alt="Una vaca"') && h.includes('loading="lazy"'), h);
  assert.ok(h.includes('href="/articulo/otra-nota"'), h);
  assert.ok(h.includes('href="https://www.contextoganadero.com/regiones/desconocida"'), h);
  assert.equal(h.includes("<p><br></p>"), false);
});

test("el resumen repetido en cursiva al principio del cuerpo se quita; un párrafo distinto se deja", () => {
  const resumen = "Creada en 2013 e inactiva desde 2020, la asociación prepara una asamblea para sumar socios.";
  const cuerpo = `<hr>\n<p><em>${resumen}</em></p>\n<hr>\n<p>Texto real de la nota.</p>`;
  assert.equal(sinResumenRepetido(cuerpo, resumen), "<p>Texto real de la nota.</p>");
  const otro = "<p><em>Una frase completamente distinta del resumen, larga y propia.</em></p><p>Texto.</p>";
  assert.equal(sinResumenRepetido(otro, resumen), otro);
});

test("elegirCategoria prefiere la sección más específica", () => {
  const arbol: Arbol = new Map([
    ["colombia", null], ["regiones", "colombia"], ["gremialidad", "colombia"], ["politica", "colombia"],
    ["economia", null], ["nacional", "economia"], ["agricultura", "economia"],
    ["ganaderia", null], ["sostenible", "ganaderia"], ["produccion", "ganaderia"],
    ["opinion", null], ["columnas", "opinion"], ["blogs", "opinion"],
    ["especiales", null], ["galeria", "especiales"],
  ]);
  assert.deepEqual(elegirCategoria("regiones", ["home", "colombia", "regiones", "gremialidad"], arbol), { principal: "regiones", todas: ["regiones", "colombia", "gremialidad"] });
  assert.equal(elegirCategoria("economia", ["home", "economia", "nacional"], arbol).principal, "nacional");
  assert.equal(elegirCategoria("economia", ["home"], arbol).principal, "economia");
  assert.equal(elegirCategoria("ganaderia-sostenible", ["home", "ganaderia", "produccion"], arbol).principal, "produccion");
  assert.equal(elegirCategoria("columna", ["home", "opinion", "columnas"], arbol).principal, "columnas");
  assert.equal(elegirCategoria("blog", ["home", "blogs"], arbol).principal, "blogs");
  assert.equal(elegirCategoria("galeria", ["home"], arbol).principal, "galeria");
  assert.equal(aCategoria("home", arbol), null);
  assert.equal(aCategoria("noexiste", arbol), null);
});

test("la galería, el video y el audio se convierten en HTML", () => {
  const html = bloquesMultimedia(
    {
      gallery: [{ items: [
        { component: "Image", title: "Pie 1", alt_text: "", image: { filename: "https://a.storyblok.com/f/1/2/a.webp" } },
        { component: "YouTubeVideo", title: "Un video", video_id: "IbnT-D4U8Pg" },
      ] }],
      audio: [{ filename: "https://a.storyblok.com/f/1/2/a.mp3" }],
    },
    ctx,
  );
  assert.ok(html.includes('<img src="https://copia.test/f/1/2/a.webp"') && html.includes("<figcaption>Pie 1</figcaption>"), html);
  assert.ok(html.includes("youtube-nocookie.com/embed/IbnT-D4U8Pg"), html);
  assert.ok(html.includes('<audio controls preload="none" src="https://copia.test/f/1/2/a.mp3">'), html);
});

test("los párrafos separados por una línea con espacio duro se cortan de verdad", () => {
  const h = limpiarHtmlAntiguo("<p><em>Resumen.</em>\n\u00a0\n<strong>Primer bloque</strong> de texto.\n\u00a0\nSegundo bloque.</p>\n<p>Aparte.</p>", ctx);
  assert.equal(h, "<p><em>Resumen.</em></p><p><strong>Primer bloque</strong> de texto.</p><p>Segundo bloque.</p>\n<p>Aparte.</p>");
  // Un salto simple dentro del párrafo no lo corta.
  assert.equal(limpiarHtmlAntiguo("<p>uno\ndos</p>", ctx), "<p>uno\ndos</p>");
});

test("el texto alternativo descarta las listas de palabras clave y el pie sale del título de la imagen en notas viejas", () => {
  const largo = "Visita embajador China, embajador de china en Colombia, Admisibilidad carne, carne Colombia China 2018, hacienda Rosario, turismo ganadero";
  assert.equal(altDePortada({ teaser_image: { alt: largo, title: "El embajador visita la finca" } }, "Titular"), "El embajador visita la finca");
  assert.equal(altDePortada({ teaser_image: { alt: largo, title: largo } }, "Titular de la nota"), "Titular de la nota");
  assert.equal(altDePortada({ teaser_image: { alt: "Un hato" } }, "T"), "Un hato");
  assert.equal(pieDeFoto({ teaser_image: { alt: "tema", title: "El embajador Li Nianping visitó la finca. Foto: Cortesía" } }, "Titular"), "El embajador Li Nianping visitó la finca. Foto: Cortesía");
  assert.equal(pieDeFoto({ teaser_image: { alt: "ASOPAGROV", title: "ASOPAGROV" } }, "Titular"), null);
});

test("el título SEO pierde el sufijo con el nombre del sitio que el portal nuevo ya añade", () => {
  const reg = (seo: string): NotaDescargada => ({ path: "/x/y", status: 200, ld: null, story: { id: 1, uuid: "u", name: "Una nota", slug: "y", full_slug: "x/y", created_at: null, first_published_at: "2020-01-01T00:00:00.000Z", published_at: null, updated_at: null, tag_list: [], content: { title: "Una nota", summary: { original: "Resumen suficientemente largo para no usar el respaldo." }, seo_meta: { title: seo, description: "" } } } });
  assert.equal(camposBasicos(reg("Queso de búfala, de Córdoba para el mundo | CONtexto Ganadero")).metaTitulo, "Queso de búfala, de Córdoba para el mundo");
  assert.equal(camposBasicos(reg("Otro titular - CONtexto ganadero")).metaTitulo, "Otro titular");
  assert.equal(camposBasicos(reg("Una nota")).metaTitulo, null);
});

test("el pie de foto suma el crédito de la imagen sin repetirlo", () => {
  assert.equal(pieDeFoto({ pie_foto: "Un hato en Cesar.", teaser_image: { source: "Fedegán" } }), "Un hato en Cesar. · Foto: Fedegán");
  assert.equal(pieDeFoto({ pie_foto: "Foto: Fedegán, un hato.", teaser_image: { source: "Fedegán" } }), "Foto: Fedegán, un hato.");
  assert.equal(pieDeFoto({ teaser_image: { copyright: "Cortesía" } }), "Foto: Cortesía");
  assert.equal(pieDeFoto({}), null);
});

test("una nota con cuerpo vacío usa el texto original y el HTML del artículo como respaldo", () => {
  const base = { path: "/x/y", status: 200, ld: null };
  const conOriginal = { ...base, story: { id: 1, uuid: "u", name: "n", slug: "y", full_slug: "x/y", created_at: null, first_published_at: null, published_at: null, updated_at: null, tag_list: [], content: { body: { html: "", original: "Primer párrafo\n\nSegundo" } } } };
  assert.match(construirCuerpo(conOriginal, "", ctx), /<p>Primer párrafo<\/p>\s*<p>Segundo<\/p>/);
  const conRespaldo = { ...base, articleHtml: "<p>Del artículo</p>", story: { ...conOriginal.story, content: { body: { html: "", original: "" } } } };
  assert.match(construirCuerpo(conRespaldo, "", ctx), /Del artículo/);
});

test("extraerNota encuentra la nota por su dirección dentro del JSON de la página", () => {
  const datos = { props: { pageProps: { QuerySeeMore: [{ id: 5, uuid: "u1", name: "Título", slug: "titulo", full_slug: "regiones/titulo", tag_list: ["a"], first_published_at: "2026-01-01T00:00:00.000Z", content: { title: "Título", relevance: [1], author: { name: "Ana", uuid: "ua", slug: "ana", content: { image: { filename: "https://a.storyblok.com/f/1/2/ana.png" }, labels: ["x"] } } } }] } } };
  const html = `<html><head><title>T | CONtexto</title><meta name="description" content="Desc"><script type="application/ld+json">{"@type":"Article","datePublished":"2026-01-01T00:00:00.000Z","dateModified":"2026-01-02T00:00:00.000Z","author":[{"name":"Ana"}]}</script></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(datos)}</script></body></html>`;
  const r = extraerNota(html, "/regiones/titulo", 200);
  assert.equal(r.story?.slug, "titulo");
  assert.equal("relevance" in (r.story?.content ?? {}), false);
  assert.deepEqual(r.story?.content.author, { uuid: "ua", name: "Ana", slug: "ana", image: "https://a.storyblok.com/f/1/2/ana.png", labels: ["x"] });
  assert.equal(r.ld?.dateModified, "2026-01-02T00:00:00.000Z");
  assert.equal(extraerNota("<html></html>", "/a/b", 404).story, null);
});

test("direccionesDeMapa lee los <loc> de un mapa del sitio", () => {
  assert.deepEqual(direccionesDeMapa("<urlset><url><loc>https://a.co/x/y</loc></url><url><loc> https://a.co/x/z?a=1&amp;b=2 </loc></url></urlset>"), ["https://a.co/x/y", "https://a.co/x/z?a=1&b=2"]);
});
