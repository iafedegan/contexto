/**
 * Genera los archivos del logo a partir de su fuente única, `src/lib/logo.ts`:
 *
 *   npx tsx scripts/generar-logo.ts          el SVG (`public/logo/contexto-ganadero-logo.svg`)
 *   npx tsx scripts/generar-logo.ts --png    además los PNG: el logo de 512 px (JSON-LD, correos) y la tarjeta de 1200 × 630
 *                                            que se ve al compartir el sitio en WhatsApp, Facebook o X
 *
 * Los PNG se dibujan con Chrome (como `scripts/responsive-audit`): `npm i -D puppeteer-core` una vez, y `CHROME_PATH` si
 * Chrome no está en la ruta de macOS. La tarjeta pide red: carga Playfair Display e Inter de Google Fonts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LOGO_COLORES, logoSvg } from "../src/lib/logo";

const CARPETA = join(process.cwd(), "public/logo");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// Lo mínimo que se usa de puppeteer-core (no es dependencia del proyecto, así que no hay tipos).
type Pagina = {
  setViewport(v: { width: number; height: number; deviceScaleFactor: number }): Promise<void>;
  setContent(html: string, o: { waitUntil: string }): Promise<void>;
  evaluate(fn: () => unknown): Promise<unknown>;
  screenshot(o: { path: string; omitBackground?: boolean }): Promise<unknown>;
};
type Navegador = { newPage(): Promise<Pagina>; close(): Promise<void> };
type Puppeteer = { launch(o: { executablePath: string; headless: boolean }): Promise<Navegador> };

// La tarjeta para compartir: la baldosa a la izquierda, el nombre en oro y el lema, sobre el verde profundo de la marca.
function tarjeta(svgDataUri: string): string {
  return `<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600&family=Playfair+Display:wght@600&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden}
  body{display:flex;align-items:center;gap:64px;padding:0 120px;box-sizing:border-box;color:${LOGO_COLORES.crema};
    background:radial-gradient(ellipse 70% 90% at 22% 45%,#0d3a28 0%,#06180f 58%,#030b07 100%);position:relative}
  body::after{content:"";position:absolute;inset:26px;border:1px solid rgba(216,181,88,.32);border-radius:6px;pointer-events:none}
  img{width:262px;height:262px;filter:drop-shadow(0 34px 50px rgba(0,0,0,.55))}
  h1{margin:0;font:600 112px/1.02 "Playfair Display",Georgia,serif;letter-spacing:-.01em}
  h1 span{display:block;background:linear-gradient(100deg,${LOGO_COLORES.oroClaro},${LOGO_COLORES.oro} 70%);-webkit-background-clip:text;background-clip:text;color:transparent}
  hr{width:96px;height:2px;border:0;margin:30px 0 22px;background:linear-gradient(90deg,${LOGO_COLORES.oro},transparent)}
  p{margin:0;font:600 22px "Inter",system-ui,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#9fb7a8;white-space:nowrap}
</style>
<img src="${svgDataUri}" alt="">
<div><h1><span>CONtexto</span>Ganadero</h1><hr><p>Periodismo del sector ganadero</p></div>`;
}

async function main() {
  mkdirSync(CARPETA, { recursive: true });
  const svg = logoSvg();
  writeFileSync(join(CARPETA, "contexto-ganadero-logo.svg"), svg + "\n");
  console.log("SVG escrito");
  if (!process.argv.includes("--png")) return;

  const nombre = "puppeteer-core"; // por nombre, para que el compilador no lo busque
  const puppeteer = ((await import(nombre)) as { default: Puppeteer }).default;
  const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true });
  try {
    const pagina = await navegador.newPage();
    const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    // Logo de 512 px, con las esquinas transparentes.
    await pagina.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
    await pagina.setContent(`<body style="margin:0;background:transparent"><img src="${uri}" width="512" height="512" style="display:block">`, { waitUntil: "load" });
    await pagina.screenshot({ path: join(CARPETA, "contexto-ganadero-logo-512.png"), omitBackground: true });
    // Tarjeta para compartir.
    await pagina.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await pagina.setContent(tarjeta(uri), { waitUntil: "networkidle0" });
    await pagina.evaluate(() => document.fonts.ready);
    await pagina.screenshot({ path: join(CARPETA, "contexto-ganadero-og.png") });
    console.log("PNG escritos");
  } finally {
    await navegador.close();
  }
}

void main();
