"use client";

/**
 * PDF del boletín: se imprime el correo, tal como se ve en la vista previa y a su ancho real, con el motor de impresión del navegador
 * («Guardar como PDF»). Así el PDF sale con texto de verdad (se puede seleccionar y buscar), con las fuentes y los colores exactos,
 * sin recortes y con los enlaces de las notas activos en cualquier visor, incluido el de Adobe. Se guarda como una sola página larga.
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
    const alto = Math.ceil(Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight));
    const fondo = win.getComputedStyle(doc.body).backgroundColor;

    // Una sola página del tamaño exacto del correo, sin márgenes, con los fondos y colores tal cual (sin pedir «Gráficos de fondo»).
    const estilo = doc.createElement("style");
    estilo.textContent = `@page{size:${ANCHO}px ${alto + 4}px;margin:0} html{background:${fondo} !important} html,body,*{-webkit-print-color-adjust:exact;print-color-adjust:exact}`;
    doc.head.appendChild(estilo);
    doc.title = nombre;
    marco.style.height = `${alto}px`;

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
