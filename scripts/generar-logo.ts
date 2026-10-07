/**
 * Genera los archivos del logo de CONtexto Ganadero.
 *
 *   npx tsx scripts/generar-logo.ts ruta/al/logo-original.jpg     extrae el emblema del diseño (le quita el fondo azul) y
 *                                                                 genera todo lo demás
 *   npx tsx scripts/generar-logo.ts                               regenera todo desde `public/logo/contexto-ganadero-emblema.png`
 *   añadir `--og` para dibujar también la tarjeta de redes (pide `npm i -D puppeteer-core`, Chrome y red: usa Google Fonts)
 *
 * Salidas en `public/logo/`:
 *   - contexto-ganadero-emblema.png     el emblema solo, con fondo transparente (fuente de las demás piezas)
 *   - contexto-ganadero-logo-512.png    el emblema sobre una baldosa del verde de la página, con esquinas redondas (el sitio,
 *                                       la pestaña y el JSON-LD)
 *   - contexto-ganadero-icon-bleed.png  cuadrado a sangre, para iOS (que le pone su propia máscara)
 *   - contexto-ganadero-maskable.png    cuadrado a sangre con el emblema dentro de la zona segura de los íconos «maskable»
 *   - contexto-ganadero-og.png          la tarjeta que se ve al compartir el sitio (con `--og`)
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const CARPETA = join(process.cwd(), "public/logo");
const EMBLEMA = join(CARPETA, "contexto-ganadero-emblema.png");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// El verde de la página (plantilla Esmeralda Real): de `--bg-2` a `--bg`.
const VERDE_CLARO = "#0b2a1c";
const VERDE = "#05100b";

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Del diseño original (emblema arriba y nombre abajo, sobre un fondo azul) saca solo el emblema y deja transparente el fondo:
 * lo cálido (dorado, naranja, crema) y el brote verde se conservan; el azul y sus sombras se quitan, y en los bordes se
 * resta el azul mezclado para que no quede un halo.
 */
async function extraerEmblema(origen: string) {
  const meta = await sharp(origen).metadata();
  const ancho = meta.width ?? 1792;
  // El emblema es un círculo centrado a ~52 % del ancho y ~34 % del alto del diseño, de ~64 % del ancho de diámetro.
  const lado = Math.round(ancho * 0.67);
  const caja = { left: Math.round(ancho * 0.518 - lado / 2), top: Math.round((meta.height ?? 2400) * 0.345 - lado / 2), width: lado, height: lado };
  const { data, info } = await sharp(origen).extract(caja).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Color del fondo: mediana de las cuatro esquinas del recorte (están fuera del círculo).
  const muestra: number[][] = [];
  for (const [x0, y0] of [[0, 0], [info.width - 60, 0], [0, info.height - 60], [info.width - 60, info.height - 60]])
    for (let y = y0; y < y0 + 60; y += 6) for (let x = x0; x < x0 + 60; x += 6) { const i = (y * info.width + x) * 4; muestra.push([data[i], data[i + 1], data[i + 2]]); }
  const mediana = (k: number) => muestra.map((m) => m[k]).sort((a, b) => a - b)[Math.floor(muestra.length / 2)];
  const fondo = [mediana(0), mediana(1), mediana(2)];

  const salida = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const luz = 0.299 * r + 0.587 * g + 0.114 * b;
    let a = clamp((r - b + 8) / 42); // lo cálido tiene más rojo que azul
    a = Math.max(a, clamp((g - Math.max(r, b) - 8) / 30)); // el brote verde
    if (luz > 170) a = 1; // crema y brillos
    const c = a > 0 && a < 1 ? [r, g, b].map((v, k) => (v - (1 - a) * fondo[k]) / a) : [r, g, b];
    salida[i] = Math.max(0, Math.min(255, c[0]));
    salida[i + 1] = Math.max(0, Math.min(255, c[1]));
    salida[i + 2] = Math.max(0, Math.min(255, c[2]));
    salida[i + 3] = Math.round(a * 255);
  }
  // Recorta al contenido, lo deja cuadrado con un pequeño margen y lo lleva a 1024 px.
  const png = await sharp(salida, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const recortado = await sharp(png).trim({ threshold: 8 }).toBuffer({ resolveWithObject: true });
  // (sharp aplica siempre primero el cambio de tamaño y después el margen.)
  await sharp(recortado.data)
    .resize(1000, 1000, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 12, bottom: 12, left: 12, right: 12, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(EMBLEMA);
  console.log("emblema extraído");
}

// Baldosa del verde de la página: rectángulo con degradado, redondeado o a sangre.
const baldosa = (lado: number, radio: number) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${VERDE_CLARO}"/><stop offset="1" stop-color="${VERDE}"/></linearGradient></defs><rect width="${lado}" height="${lado}" rx="${radio}" fill="url(#g)"/></svg>`,
  );

// Emblema centrado sobre la baldosa, ocupando `proporcion` del lado.
async function pieza(nombre: string, lado: number, radio: number, proporcion: number) {
  const tam = Math.round(lado * proporcion);
  const emblema = await sharp(EMBLEMA).resize(tam, tam).toBuffer();
  await sharp(baldosa(lado, radio)).composite([{ input: emblema, gravity: "centre" }]).png().toFile(join(CARPETA, nombre));
  console.log(nombre);
}

// Tipos mínimos de puppeteer-core (no es dependencia del proyecto).
type Pagina = { setViewport(v: { width: number; height: number; deviceScaleFactor: number }): Promise<void>; setContent(h: string, o: { waitUntil: string }): Promise<void>; evaluate(f: () => unknown): Promise<unknown>; screenshot(o: { path: string }): Promise<unknown> };
type Navegador = { newPage(): Promise<Pagina>; close(): Promise<void> };

// Tarjeta de redes: el emblema a la izquierda y el nombre en oro con el lema, sobre el verde de la marca.
async function tarjeta() {
  const emblema = `data:image/png;base64,${readFileSync(EMBLEMA).toString("base64")}`;
  const nombre = "puppeteer-core";
  const puppeteer = ((await import(nombre)) as { default: { launch(o: { executablePath: string; headless: boolean }): Promise<Navegador> } }).default;
  const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true });
  try {
    const pagina = await navegador.newPage();
    await pagina.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await pagina.setContent(
      `<!doctype html><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@600&family=Playfair+Display:wght@600&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{display:flex;align-items:center;gap:56px;padding:0 110px;box-sizing:border-box;color:#f4f2e9;background:radial-gradient(ellipse 70% 90% at 22% 45%,${VERDE_CLARO} 0%,${VERDE} 62%,#030b07 100%);position:relative}
body::after{content:"";position:absolute;inset:26px;border:1px solid rgba(216,181,88,.32);border-radius:6px}
img{width:380px;height:380px;filter:drop-shadow(0 30px 40px rgba(0,0,0,.5))}
h1{margin:0;font:600 108px/1.02 "Playfair Display",Georgia,serif;letter-spacing:-.01em}
h1 span{display:block;background:linear-gradient(100deg,#f4d98a,#c8982a 70%);-webkit-background-clip:text;background-clip:text;color:transparent}
hr{width:96px;height:2px;border:0;margin:28px 0 20px;background:linear-gradient(90deg,#c8982a,transparent)}
p{margin:0;font:600 22px "Inter",system-ui,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#9fb7a8;white-space:nowrap}</style>
<img src="${emblema}" alt=""><div><h1><span>CONtexto</span>Ganadero</h1><hr><p>Periodismo del sector ganadero</p></div>`,
      { waitUntil: "networkidle0" },
    );
    await pagina.evaluate(() => document.fonts.ready);
    await pagina.screenshot({ path: join(CARPETA, "contexto-ganadero-og.png") });
    console.log("contexto-ganadero-og.png");
  } finally {
    await navegador.close();
  }
}

async function main() {
  mkdirSync(CARPETA, { recursive: true });
  const origen = process.argv.find((a, i) => i > 1 && !a.startsWith("--"));
  if (origen) await extraerEmblema(origen);
  await pieza("contexto-ganadero-logo-512.png", 512, 112, 0.9);
  await pieza("contexto-ganadero-icon-bleed.png", 1024, 0, 0.84);
  await pieza("contexto-ganadero-maskable.png", 1024, 0, 0.62);
  if (process.argv.includes("--og")) await tarjeta();
}

void main();
