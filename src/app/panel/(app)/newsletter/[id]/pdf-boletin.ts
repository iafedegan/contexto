"use client";

/**
 * Descarga del boletín como PDF, en el navegador (sin servidor): dibuja el correo tal como se ve en la vista previa, a su ancho real, y
 * lo guarda como una sola página larga, con los enlaces de las notas activos. Las librerías pesadas se cargan solo al pulsar el botón.
 */

const ANCHO = 680;
const ESCALA = 2;

// Quita las reglas de «modo oscuro» del correo: el PDF debe salir con el diseño elegido, no con el tema del equipo de quien lo descarga.
const sinModoOscuro = (html: string) => html.replace(/@media \(prefers-color-scheme: dark\)\s*\{[\s\S]*?\n  \}\n/, "");

// Solo para el PDF: nada recorta el texto de una nota aunque la caja mida un poco menos que su contenido.
const ESTILO_PDF = "<style>* { overflow: visible !important; }</style>";
const conEstiloPdf = (html: string) => (html.includes("</head>") ? html.replace("</head>", `${ESTILO_PDF}</head>`) : ESTILO_PDF + html);

// Espera a que todas las imágenes del documento hayan cargado (o fallado).
const imagenesListas = (doc: Document) =>
  Promise.all(
    [...doc.images].map((img) => (img.complete ? Promise.resolve() : new Promise<void>((ok) => { img.onload = () => ok(); img.onerror = () => ok(); }))),
  );

/**
 * Deja cada foto con su tamaño exacto en píxeles y, si el origen lo permite, incrustada en la propia página (reducida al tamaño que se dibuja).
 * Así la composición no depende de que las fotos vuelvan a cargarse mientras se dibuja el PDF: medidas, texto y enlaces salen del mismo diseño.
 */
async function fijarImagenes(doc: Document): Promise<void> {
  const imgs = [...doc.images];
  const medidas = imgs.map((img) => img.getBoundingClientRect());
  imgs.forEach((img, i) => {
    const { width, height } = medidas[i];
    if (width < 1 || height < 1) return;
    img.style.setProperty("width", `${width}px`, "important");
    img.style.setProperty("height", `${height}px`, "important");
    img.style.setProperty("max-width", "none", "important");
  });
  await Promise.all(
    imgs.map(async (img, i) => {
      const { width } = medidas[i];
      const url = img.currentSrc || img.src;
      if (width < 1 || !/^https?:/i.test(url)) return;
      try {
        const fuente = new Image();
        fuente.crossOrigin = "anonymous";
        await new Promise<void>((ok, fallo) => { fuente.onload = () => ok(); fuente.onerror = () => fallo(new Error("sin CORS")); fuente.src = url; });
        const k = Math.min(1, (width * ESCALA) / fuente.naturalWidth);
        const lienzo = document.createElement("canvas");
        lienzo.width = Math.max(1, Math.round(fuente.naturalWidth * k));
        lienzo.height = Math.max(1, Math.round(fuente.naturalHeight * k));
        const ctx = lienzo.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(fuente, 0, 0, lienzo.width, lienzo.height);
        const datos = lienzo.toDataURL(/\.(png|gif|webp|svg)(\?|$)/i.test(url) ? "image/png" : "image/jpeg", 0.9);
        await new Promise<void>((ok) => { img.onload = () => ok(); img.onerror = () => ok(); img.src = datos; });
      } catch {
        /* el origen no deja leer la foto: se queda la original (html2canvas la pedirá con CORS) */
      }
    }),
  );
}

type Zona = { x: number; y: number; w: number; h: number; url: string };

/**
 * Zonas clicables del PDF, medidas en el mismo documento con el que se dibuja:
 * cada enlace del correo y, además, la nota entera (foto, titular y resumen), para que pulsar en cualquier parte de la nota la abra.
 */
function zonasDeEnlaces(doc: Document): Zona[] {
  const origen = doc.body.getBoundingClientRect();
  const zona = (el: Element, url: string): Zona | null => {
    const r = el.getBoundingClientRect();
    return r.width < 4 || r.height < 4 ? null : { x: r.left - origen.left, y: r.top - origen.top, w: r.width, h: r.height, url };
  };
  const anclas = [...doc.querySelectorAll<HTMLAnchorElement>("a[href^='http']")];
  const rutaDeNota = (a: HTMLAnchorElement) => {
    try {
      const { pathname } = new URL(a.href);
      return pathname.startsWith("/articulo/") ? pathname : null;
    } catch {
      return null;
    }
  };

  const notas = new Map<string, HTMLAnchorElement[]>();
  for (const a of anclas) {
    const ruta = rutaDeNota(a);
    if (ruta) notas.set(ruta, [...(notas.get(ruta) ?? []), a]);
  }

  const zonas: Zona[] = [];
  for (const lista of notas.values()) {
    const propios = new Set<Element>(lista);
    // Desde cada enlace de la nota se sube mientras el contenedor no incluya ningún enlace ajeno (otra nota, el sitio, la baja…).
    const bloques = new Set<Element>();
    for (const a of lista) {
      let el: Element = a;
      while (el.parentElement && el.parentElement !== doc.body) {
        const padre = el.parentElement;
        if ([...padre.querySelectorAll("a[href]")].some((x) => !propios.has(x))) break;
        // Una celda vacía a su lado (relleno de la rejilla) no forma parte de la nota.
        if (padre.tagName === "TR" && [...padre.children].some((c) => !c.textContent?.trim() && !c.querySelector("img"))) break;
        el = padre;
      }
      if (el !== a) bloques.add(el);
    }
    for (const b of bloques) {
      if ([...bloques].some((o) => o !== b && o.contains(b))) continue;
      const z = zona(b, lista[0].href);
      if (z) zonas.push(z);
    }
  }
  // Los enlaces concretos van al final: quedan por encima de la zona de su nota.
  for (const a of anclas) {
    const z = zona(a, a.href);
    if (z) zonas.push(z);
  }
  return zonas;
}

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
    await new Promise<void>((ok) => { marco.onload = () => ok(); marco.srcdoc = conEstiloPdf(sinModoOscuro(html)); });
    const doc = marco.contentDocument;
    if (!doc) throw new Error("No se pudo preparar el documento.");
    await imagenesListas(doc);
    await doc.fonts?.ready;
    await fijarImagenes(doc);
    const cuerpo = doc.body;
    const alto = Math.ceil(Math.max(cuerpo.scrollHeight, doc.documentElement.scrollHeight));
    marco.style.height = `${alto}px`;

    // Las zonas se miden en el documento que html2canvas usa para dibujar; si no se pudo, en el original.
    let zonas: Zona[] | null = null;
    const lienzo = await html2canvas(cuerpo, {
      scale: ESCALA, useCORS: true, backgroundColor: "#ffffff", width: ANCHO, height: alto, windowWidth: ANCHO, windowHeight: alto, logging: false,
      onclone: (clonado) => { try { zonas = zonasDeEnlaces(clonado); } catch { zonas = null; } },
    });
    const pdf = new jsPDF({ orientation: "p", unit: "px", format: [ANCHO, alto], hotfixes: ["px_scaling"], compress: true });
    pdf.addImage(lienzo.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, ANCHO, alto, undefined, "FAST");

    // Los enlaces del correo siguen funcionando dentro del PDF.
    for (const z of (zonas as Zona[] | null) ?? zonasDeEnlaces(doc)) pdf.link(z.x, z.y, z.w, z.h, { url: z.url });
    pdf.setProperties({ title: nombre, creator: "CONtexto Ganadero" });
    pdf.save(`${nombre}.pdf`);
  } finally {
    marco.remove();
  }
}
