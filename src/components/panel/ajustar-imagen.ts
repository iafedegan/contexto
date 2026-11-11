/**
 * Ajuste de la imagen de portada en el navegador: encuadre 16:9, tamaño que pide Google Discover (≥ 1200 px de ancho) y una mejora
 * ligera de contraste y nitidez. No inventa detalle que la foto no tiene: una imagen muy pequeña queda más limpia, no más detallada.
 */
export type Ajuste = {
  /** Dónde se centra el recorte, de 0 a 1 (0 = izquierda o arriba, 0,5 = centro, 1 = derecha o abajo). */
  fx: number;
  fy: number;
  /** Estira el contraste y afina los bordes. */
  mejorar: boolean;
};

export const ANCHO_PORTADA = 1600;

/** Recorte 16:9 de una imagen de `w`×`h`, con el foco en (`fx`, `fy`). */
export function recorte169(w: number, h: number, fx: number, fy: number) {
  const objetivo = 16 / 9;
  if (w / h >= objetivo) {
    const cw = Math.round(h * objetivo);
    return { sx: Math.round((w - cw) * fx), sy: 0, sw: cw, sh: h };
  }
  const ch = Math.round(w / objetivo);
  return { sx: 0, sy: Math.round((h - ch) * fy), sw: w, sh: ch };
}

// Estira el contraste entre los percentiles 1 y 99 de la luminosidad (con un tope, para no romper las fotos ya correctas).
function autoContraste(d: Uint8ClampedArray) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) hist[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])] += 1;
  const total = d.length / 4;
  let acum = 0;
  let bajo = 0;
  let alto = 255;
  for (let v = 0; v < 256; v++) { acum += hist[v]; if (acum >= total * 0.01) { bajo = v; break; } }
  acum = 0;
  for (let v = 255; v >= 0; v--) { acum += hist[v]; if (acum >= total * 0.01) { alto = v; break; } }
  if (alto - bajo < 60) return;
  const ganancia = Math.min(1.35, 255 / (alto - bajo));
  for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = (d[i + c] - bajo) * ganancia;
}

// Máscara de enfoque suave: realza los bordes sin los halos de un enfoque fuerte.
function afinar(img: ImageData, cantidad: number) {
  const { width: w, height: h, data: d } = img;
  const copia = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const vecinos = copia[i - 4 + c] + copia[i + 4 + c] + copia[i - w * 4 + c] + copia[i + w * 4 + c];
        d[i + c] = copia[i + c] + cantidad * (4 * copia[i + c] - vecinos) / 4;
      }
    }
  }
}

/** Dibuja la imagen recortada a 16:9 en un lienzo de `ancho` px, con ampliación gradual si hace falta, y devuelve el lienzo. */
export async function renderizarPortada(archivo: File, ajuste: Ajuste, ancho: number): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(archivo);
  const { sx, sy, sw, sh } = recorte169(bmp.width, bmp.height, ajuste.fx, ajuste.fy);
  const alto = Math.round((ancho * 9) / 16);
  // Ampliar de golpe se ve en bloques: se sube por escalones de hasta 1,5×.
  let actual = document.createElement("canvas");
  actual.width = sw;
  actual.height = sh;
  actual.getContext("2d")!.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
  bmp.close();
  while (actual.width < ancho) {
    const nuevoAncho = Math.min(ancho, Math.round(actual.width * 1.5));
    const siguiente = document.createElement("canvas");
    siguiente.width = nuevoAncho;
    siguiente.height = Math.round((nuevoAncho * sh) / sw);
    const g = siguiente.getContext("2d")!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(actual, 0, 0, siguiente.width, siguiente.height);
    actual = siguiente;
  }
  const salida = document.createElement("canvas");
  salida.width = ancho;
  salida.height = alto;
  const g = salida.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(actual, 0, 0, ancho, alto);
  if (ajuste.mejorar) {
    const datos = g.getImageData(0, 0, ancho, alto);
    autoContraste(datos.data);
    afinar(datos, actual.width < sw * 1.2 ? 0.35 : 0.6);
    g.putImageData(datos, 0, 0);
  }
  return salida;
}

/** El lienzo como archivo listo para subir: WebP si el navegador sabe generarlo (pesa mucho menos) y, si no, JPEG. */
export function aArchivo(lienzo: HTMLCanvasElement, nombre: string): Promise<File> {
  const base = nombre.replace(/\.[a-z0-9]+$/i, "");
  return new Promise((resolver, rechazar) => {
    lienzo.toBlob(
      (webp) => {
        if (webp && webp.type === "image/webp") return resolver(new File([webp], `${base}.webp`, { type: "image/webp" }));
        lienzo.toBlob((jpg) => (jpg ? resolver(new File([jpg], `${base}.jpg`, { type: "image/jpeg" })) : rechazar(new Error("No se pudo generar la imagen."))), "image/jpeg", 0.88);
      },
      "image/webp",
      0.86,
    );
  });
}
