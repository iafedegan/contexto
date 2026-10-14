"use client";

/**
 * PDF del boletín: se imprime el correo, tal como se ve en la vista previa y a su ancho real, con el motor de impresión del navegador
 * («Guardar como PDF»). Así el PDF sale con texto de verdad (se puede seleccionar y buscar), con las fuentes y los colores exactos,
 * sin recortes y con los enlaces de las notas activos en cualquier visor, incluido el de Adobe. Sale PAGINADO como una revista (páginas A4 que se
 * pasan una a una), cuidando que una nota no quede partida entre dos páginas.
 */

const ANCHO = 680;

// Quita las reglas de «modo oscuro» del correo: el PDF debe salir con el diseño elegido, no con el tema del equipo de quien lo descarga.
const sinModoOscuro = (html: string) => html.replace(/@media \(prefers-color-scheme: dark\)\s*\{[\s\S]*?\n  \}\n/, "");

// Espera a que todas las imágenes del documento hayan cargado (o fallado).
const imagenesListas = (doc: Document) =>
  Promise.all(
    [...doc.images].map((img) => (img.complete ? Promise.resolve() : new Promise<void>((ok) => { img.onload = () => ok(); img.onerror = () => ok(); }))),
  );

/** Abre el cuadro de impresión con el correo listo para guardarlo como PDF (`html` es el de la vista previa). Lanza si algo falla. */
export async function descargarPdfBoletin(html: string, nombre: string): Promise<void> {
  document.querySelectorAll("iframe[data-pdf-boletin]").forEach((f) => f.remove());

  // Marco fuera de pantalla con el correo a su ancho real. `allow-modals` es lo que permite imprimir desde un marco aislado.
  const marco = document.createElement("iframe");
  marco.setAttribute("sandbox", "allow-same-origin allow-modals");
  marco.setAttribute("aria-hidden", "true");
  marco.setAttribute("data-pdf-boletin", "");
  marco.style.cssText = `position:fixed;left:-10000px;top:0;width:${ANCHO}px;height:1200px;border:0`;
  document.body.appendChild(marco);
  const quitar = () => marco.remove();
  try {
    await new Promise<void>((ok) => { marco.onload = () => ok(); marco.srcdoc = sinModoOscuro(html); });
    const win = marco.contentWindow;
    const doc = marco.contentDocument;
    if (!win || !doc) throw new Error("No se pudo preparar el documento.");
    await imagenesListas(doc);
    await doc.fonts?.ready;
    // El color de fondo REAL del correo: el `body` suele ser transparente y el color está en la tabla que lo envuelve. Se baja por el primer
    // hijo hasta dar con uno pintado; ese color cubre toda la hoja (también los márgenes), así no quedan bordes blancos.
    const pintado = (el: Element) => {
      const c = win.getComputedStyle(el).backgroundColor;
      return c && c !== "transparent" && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c) ? c : null;
    };
    let fondo = "#ffffff";
    for (let el: Element | null = doc.body, n = 0; el && n < 8; el = el.firstElementChild, n++) {
      const c = pintado(el);
      if (c) { fondo = c; if (el !== doc.body) break; }
    }

    // Páginas A4 SIN márgenes (así el navegador tampoco imprime fecha ni dirección arriba y abajo) con el fondo en toda la hoja. El correo
    // se ensancha un poco para aprovechar la página y se centra; las notas no se parten entre dos páginas ni tampoco las imágenes.
    const estilo = doc.createElement("style");
    estilo.textContent = `@page{size:A4;margin:0}
      html,body{background:${fondo} !important;margin:0 !important;min-height:100%}
      html,body,*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{max-width:${ANCHO}px;margin:0 auto !important;padding:14mm 0 !important;zoom:1.1}
      img{image-rendering:auto;-ms-interpolation-mode:bicubic}
      tr,td,img,h1,h2,h3{break-inside:avoid;page-break-inside:avoid}
      h1,h2,h3{break-after:avoid;page-break-after:avoid}`;
    doc.head.appendChild(estilo);
    doc.title = nombre;
    marco.style.height = `${Math.ceil(Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight))}px`;

    // El marco se quita al terminar de imprimir (Chrome espera a que se cierre el cuadro; otros navegadores devuelven enseguida).
    win.addEventListener("afterprint", () => setTimeout(quitar, 1000), { once: true });
    setTimeout(quitar, 5 * 60_000);
    win.focus();
    win.print();
  } catch (e) {
    quitar();
    throw e;
  }
}
