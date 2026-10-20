// Convierte los documentos de docs/obligacion-19/*.md en PDF controlados (portada con control de versiones, pie con código y página) y
// calcula la huella SHA-256 de cada uno. Uso: npm i --no-save marked && node scripts/docs-pdf.mjs <carpeta-md> <carpeta-salida>
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { marked } from "marked";

const [, , entrada = "docs/obligacion-19", salida = "salida-pdf"] = process.argv;
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FECHA = process.env.DOC_FECHA || "19 de octubre de 2026";
fs.mkdirSync(salida, { recursive: true });

const css = `
@page { size: A4; margin: 22mm 18mm 20mm 18mm;
  @bottom-left { content: "CONtexto Ganadero · @@COD@@ · v@@VER@@"; font: 8pt Helvetica, Arial, sans-serif; color: #56655b }
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8pt Helvetica, Arial, sans-serif; color: #56655b }
  @top-right { content: "Documento controlado · Confidencial"; font: 8pt Helvetica, Arial, sans-serif; color: #56655b } }
* { box-sizing: border-box }
body { font: 10pt/1.45 Helvetica, Arial, sans-serif; color: #142019; margin: 0 }
.portada { page-break-after: always; padding-top: 30mm }
.portada .k { color: #9a7a2a; letter-spacing: .14em; text-transform: uppercase; font-size: 9pt; font-weight: 700; margin: 0 }
.portada h1 { font: 700 26pt/1.1 Georgia, serif; color: #14472d; margin: 6mm 0 4mm; border: 0 }
.portada .sub { font-size: 12pt; color: #56655b; margin: 0 0 12mm }
table.ctl { width: 100%; border-collapse: collapse; font-size: 9.5pt }
table.ctl td { border: 1px solid #c9d3cb; padding: 2.2mm 3mm; vertical-align: top }
table.ctl td:first-child { width: 38mm; background: #eef3ef; font-weight: 700 }
.firmas { margin-top: 14mm; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8mm; font-size: 9pt }
.firmas div { border-top: 1px solid #142019; padding-top: 2mm; min-height: 20mm }
h1 { font: 700 17pt/1.2 Georgia, serif; color: #14472d; margin: 10mm 0 3mm; border-bottom: 2px solid #14472d; padding-bottom: 1.5mm; page-break-after: avoid }
h2 { font: 700 12.5pt/1.25 Georgia, serif; color: #14472d; margin: 7mm 0 2mm; page-break-after: avoid }
h3 { font: 700 10.5pt/1.3 Helvetica, Arial, sans-serif; color: #142019; margin: 5mm 0 1.5mm; page-break-after: avoid }
p, li { orphans: 3; widows: 3 }
ul, ol { padding-left: 6mm; margin: 2mm 0 }
table { border-collapse: collapse; width: 100%; margin: 3mm 0; font-size: 8.8pt; page-break-inside: auto }
tr { page-break-inside: avoid }
th { background: #14472d; color: #fff; text-align: left; padding: 1.6mm 2.2mm; font-weight: 700 }
td { border: 1px solid #c9d3cb; padding: 1.4mm 2.2mm; vertical-align: top }
tbody tr:nth-child(even) td { background: #f5f8f5 }
code { font: 8.6pt Menlo, Consolas, monospace; background: #eef1ee; padding: .2mm 1mm; border-radius: 1mm }
pre { background: #f1f4f1; border: 1px solid #d5ddd6; border-radius: 1.5mm; padding: 2.5mm; font: 8.3pt/1.4 Menlo, Consolas, monospace; white-space: pre-wrap; word-break: break-word; page-break-inside: avoid }
pre code { background: none; padding: 0 }
blockquote { margin: 3mm 0; padding: 2mm 4mm; border-left: 3px solid #9a7a2a; background: #fbf7ec; color: #3a3320 }
img { max-width: 100%; height: auto }
a { color: #14472d }
.salto { page-break-before: always }
`;

const archivos = fs.readdirSync(entrada).filter((f) => /^\d\d.*\.md$/.test(f)).sort();
const huellas = [];
for (const f of archivos) {
  const crudo = fs.readFileSync(path.join(entrada, f), "utf8");
  const m = crudo.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${f}: falta el encabezado de control`);
  const meta = Object.fromEntries(m[1].split("\n").map((l) => [l.slice(0, l.indexOf(":")).trim(), l.slice(l.indexOf(":") + 1).trim()]));
  const cuerpo = marked.parse(m[2].replace(/<!--\s*SALTO\s*-->/g, '<div class="salto"></div>'));
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>${meta.titulo}</title><style>${css.replace("@@COD@@", meta.codigo).replace("@@VER@@", meta.version)}</style>
<body><section class="portada"><p class="k">CONtexto Ganadero · Modernización del portal de noticias · Obligación 19</p>
<h1>${meta.titulo}</h1><p class="sub">${meta.subtitulo || ""}</p>
<table class="ctl">
<tr><td>Código</td><td>${meta.codigo}</td></tr><tr><td>Versión</td><td>${meta.version}</td></tr><tr><td>Fecha de emisión</td><td>${FECHA}</td></tr>
<tr><td>Dirigido a</td><td>${meta.audiencia}</td></tr><tr><td>Estado</td><td>Emitido para revisión y aprobación de FEDEGÁN</td></tr>
<tr><td>Elaboró</td><td>OpenView Consultant — equipo de desarrollo</td></tr>
<tr><td>Fuente de los datos</td><td>${meta.fuente || "Código fuente del repositorio, base de datos de producción y configuración del despliegue, verificados el " + FECHA}</td></tr>
<tr><td>Clasificación</td><td>Confidencial — uso de FEDEGÁN y sus auditores. No contiene credenciales ni secretos.</td></tr></table>
<div class="firmas"><div>Elaboró<br><small>OpenView Consultant</small></div><div>Revisó<br><small>Contraparte técnica FEDEGÁN</small></div><div>Aprobó<br><small>Supervisor del contrato — FEDEGÁN</small></div></div></section>
${cuerpo}</body></html>`;
  const base = f.replace(/\.md$/, "");
  const htmlRuta = path.resolve(salida, `${base}.html`);
  fs.writeFileSync(htmlRuta, html);
  // Las imágenes relativas se resuelven desde la carpeta de los .md.
  fs.writeFileSync(htmlRuta, html.replace("<head>", "<head>").replace("<meta charset", `<base href="file://${path.resolve(entrada)}/"><meta charset`));
  const pdf = path.resolve(salida, `${base}.pdf`);
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${pdf}`, `file://${htmlRuta}`], { stdio: "ignore" });
  if (!process.env.DOC_KEEP_HTML) fs.unlinkSync(htmlRuta);
  const h = crypto.createHash("sha256").update(fs.readFileSync(pdf)).digest("hex");
  huellas.push(`${h}  ${base}.pdf`);
  console.log("PDF", base, `(${Math.round(fs.statSync(pdf).size / 1024)} KB)`);
}
// Solo líneas «huella  archivo», para que `shasum -a 256 -c HUELLAS_SHA256.txt` verifique sin avisos.
fs.writeFileSync(path.join(salida, "HUELLAS_SHA256.txt"), `${huellas.join("\n")}\n`);
