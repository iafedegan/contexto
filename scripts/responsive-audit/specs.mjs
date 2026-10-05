// Genera las "tandas" de medición en .audit/specs/*.json. Uso: node scripts/responsive-audit/specs.mjs
// Opcionales: AUDIT_ARTICLE (slug), AUDIT_CATEGORY (slug), AUDIT_ARTICLE_ID (uuid de un artículo para el editor del panel).
import fs from "node:fs";
import path from "node:path";

// Carpeta donde se escriben las especificaciones.
const out = path.join(path.resolve(process.env.AUDIT_OUT || ".audit"), "specs");
fs.mkdirSync(out, { recursive: true });
// Nota de ejemplo para auditar.
const ART = `/articulo/${process.env.AUDIT_ARTICLE || "precio-novillo-gordo-sube-4-por-ciento-en-medellin"}`;
// Sección de ejemplo para auditar.
const CAT = `/categoria/${process.env.AUDIT_CATEGORY || "ganaderia"}`;
// Crea la definición de una ruta.
const r = (id, url, extra = {}) => ({ id, url, ...extra });

// Rutas públicas que se auditan.
const PUBLICAS = [
  r("home", "/"), r("categoria", CAT), r("articulo", ART), r("autor", "/autor/redaccion"), r("buscar", "/buscar"), r("buscar-q", "/buscar?q=ganado"),
  r("asistente", "/asistente"), r("boletin", "/boletin"), r("boletin-confirmar", "/boletin/confirmar"), r("boletin-baja", "/boletin/baja"), r("contacto", "/contacto"),
  r("derechos", "/derechos-de-autor"), r("feeds", "/feeds"), r("paute", "/paute-con-nosotros"), r("cookies", "/politica-de-cookies"), r("privacidad", "/politica-de-privacidad"),
  r("editorial", "/politica-editorial"), r("faq", "/preguntas-frecuentes"), r("quienes", "/quienes-somos"), r("terminos", "/terminos-y-condiciones"), r("offline", "/offline"),
  r("404", "/esta-ruta-no-existe"), r("en-home", "/en"), r("en-articulo", `/en${ART}`), r("en-boletin", "/en/boletin"),
];
// Tamaños de pantalla principales.
const CORE = ["390x844", "320x568", "768x1024", "1440x900", "375x667", "430x932", "1024x768", "1280x720", "1920x1080"];
// Capturas que se toman.
const shots = ["home", "categoria", "articulo", "buscar", "boletin", "contacto", "quienes", "asistente"].flatMap((route) => ["390x844", "768x1024", "1440x900"].map((vp) => ({ route, vp })));

// Escribe una especificación en disco.
const write = (name, spec) => fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ name, ...spec }, null, 1));

// 1) Todas las páginas públicas con la plantilla activa
write("publico", { vps: CORE, routes: PUBLICAS, shots, ipBase: 1 });

// 2) Las seis plantillas (se publica cada una desde el editor: necesita la sesión del panel)
const PLANTILLAS = { esmeralda: "Esmeralda Real", clasico: "Clásico", revista: "Revista", compacto: "Compacto", vanguardia: "Vanguardia", gremial: "Gremial" };
// Rutas clave para las pruebas rápidas.
const CLAVE = PUBLICAS.filter((x) => ["home", "categoria", "articulo", "buscar", "boletin", "quienes"].includes(x.id));
Object.entries(PLANTILLAS).forEach(([id, label], n) => {
  write(`plantilla-${id}`, {
    auth: true, template: label, ipBase: 10 + n, routes: CLAVE,
    vps: ["390x844", "320x568", "768x1024", "1024x768", "1440x900", "375x667", "1280x720", "1920x1080"],
    shots: [{ route: "home", vp: "390x844" }, { route: "home", vp: "1440x900" }, { route: "articulo", vp: "390x844" }],
  });
});

// 3) Panel editorial (autenticado)
const PANEL = [
  r("p-resumen", "/panel"), r("p-articulos", "/panel/articulos"), r("p-avisos", "/panel/avisos"), r("p-borradores", "/panel/borradores-ia"), r("p-demanda", "/panel/demanda"),
  r("p-mensajes", "/panel/mensajes"), r("p-newsletter", "/panel/newsletter"), r("p-portada", "/panel/portada", { wait: 4500 }), r("p-secciones", "/panel/secciones"), r("p-api", "/panel/api"),
];
if (process.env.AUDIT_ARTICLE_ID) PANEL.push(r("p-articulo", `/panel/articulos/${process.env.AUDIT_ARTICLE_ID}`));
for (const [id, tab] of [["p-cfg-sitio", "Identidad"], ["p-cfg-usuarios", "Personas"], ["p-cfg-seguridad", "Seguridad"], ["p-cfg-analitica", "Analítica"], ["p-cfg-asistente", "Asistente"]]) {
  PANEL.push(r(id, "/panel/configuracion", { click: tab }));
}
write("panel", { auth: true, ipBase: 30, vps: ["390x844", "768x1024", "1440x900", "320x568", "1024x768", "375x667"], routes: PANEL, shots: PANEL.flatMap((x) => ["390x844", "768x1024"].map((vp) => ({ route: x.id, vp }))) });

// 4) Teléfono en horizontal (barras fijas, popup, menú): páginas clave
write("horizontal", { vps: ["844x390", "667x375", "1024x768"], routes: PUBLICAS.filter((x) => ["home", "categoria", "articulo", "boletin"].includes(x.id)), shots: [{ route: "home", vp: "844x390" }, { route: "articulo", vp: "844x390" }], ipBase: 70 });

console.log("Tandas generadas en", out, ":", fs.readdirSync(out).join(", "));
