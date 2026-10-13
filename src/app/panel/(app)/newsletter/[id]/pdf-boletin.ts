"use client";

/**
 * Descarga del boletín como PDF, en el navegador (sin servidor): dibuja el correo tal como se ve en la vista previa, a su ancho real, y
 * lo guarda como una sola página larga, con los enlaces de las notas activos. Las librerías pesadas se cargan solo al pulsar el botón.
 */

const ANCHO = 680;
const ESCALA = 2;

// Quita las reglas de «modo oscuro» del correo: el PDF debe salir con el diseño elegido, no con el tema del equipo de quien lo descarga.
const sinModoOscuro = (html: string) => html.replace(/@media \(prefers-color-scheme: dark\)\s*\{[\s\S]*?\n  \}\n/, "");

// Espera a que todas las imágenes del documento hayan cargado (o fallado).
const imagenesListas = (doc: Document) =>
  Promise.all(
    [...doc.images].map((img) => (img.complete ? Promise.resolve() : new Promise<void>((ok) => { img.onload = () => ok(); img.onerror = () => ok(); }))),
  );

/** Genera y descarga el PDF del correo (`html` es el de la vista previa). Lanza si algo falla. */
export async function descargarPdfBoletin(html: string, nombre: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  // Marco fuera de pantalla con el correo a su ancho real.
  const marco = document.createElement("iframe");
  marco.setAttribute("sandbox", "allow-same-origin");
  marco.setAttribute("aria-hidden", "true");
  marco.style.cssText = `position:fixed;left:-10000px;top:0;width:${ANCHO}px;height:1200px;border:0;visibility:hidden`;
  document.body.appendChild(marco);
  try {
    await new Promise<void>((ok) => { marco.onload = () => ok(); marco.srcdoc = sinModoOscuro(html); });
    const doc = marco.contentDocument;
    if (!doc) throw new Error("No se pudo preparar el documento.");
    await imagenesListas(doc);
    await doc.fonts?.ready;
    const cuerpo = doc.body;
    const alto = Math.ceil(Math.max(cuerpo.scrollHeight, doc.documentElement.scrollHeight));
    marco.style.height = `${alto}px`;

    const lienzo = await html2canvas(cuerpo, { scale: ESCALA, useCORS: true, backgroundColor: "#ffffff", width: ANCHO, height: alto, windowWidth: ANCHO, windowHeight: alto, logging: false });
    const pdf = new jsPDF({ orientation: "p", unit: "px", format: [ANCHO, alto], hotfixes: ["px_scaling"], compress: true });
    pdf.addImage(lienzo.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, ANCHO, alto, undefined, "FAST");

    // Los enlaces del correo siguen funcionando dentro del PDF.
    const origen = cuerpo.getBoundingClientRect();
    for (const a of [...doc.querySelectorAll("a[href^='http']")] as HTMLAnchorElement[]) {
      const r = a.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      pdf.link(r.left - origen.left, r.top - origen.top, r.width, r.height, { url: a.href });
    }
    pdf.setProperties({ title: nombre, creator: "CONtexto Ganadero" });
    pdf.save(`${nombre}.pdf`);
  } finally {
    marco.remove();
  }
}
