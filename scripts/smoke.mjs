/**
 * Prueba de humo de extremo a extremo (H-18): contra un sitio YA en marcha (`npm run build && npx next start`), comprueba
 * por HTTP lo esencial y los controles de seguridad y de editorial que las auditorías pidieron. En CI corre tras la
 * compilación (ver .github/workflows/ci.yml); en local:
 *
 *   npx tsx scripts/dev-setup.ts && npx next start -p 3999 &   # y luego
 *   SMOKE_URL=http://127.0.0.1:3999 npm run smoke
 *
 * Sale con código 1 si algo falla y lista todo lo que falló. No necesita navegador ni claves.
 */
const BASE = (process.env.SMOKE_URL ?? "http://127.0.0.1:3999").replace(/\/$/, "");
const UA_NAVEGADOR = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const fallos = [];
let hechas = 0;

// Una comprobación: si lanza o devuelve falso, queda registrada.
async function comprobar(nombre, fn) {
  hechas++;
  try {
    const r = await fn();
    if (r === false) throw new Error("devolvió falso");
    console.log(`  ✔ ${nombre}`);
  } catch (e) {
    fallos.push(`${nombre}: ${e.message}`);
    console.log(`  ✖ ${nombre} — ${e.message}`);
  }
}
// Pide una dirección sin seguir redirecciones.
const pedir = (ruta, opciones = {}) =>
  fetch(BASE + ruta, { redirect: "manual", ...opciones, headers: { "user-agent": UA_NAVEGADOR, ...(opciones.headers ?? {}) } });
// Lanza si la condición no se cumple.
function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

// Espera a que el sitio responda (hasta 90 s).
async function esperarSitio() {
  const limite = Date.now() + 90_000;
  for (;;) {
    try {
      if ((await pedir("/api/health")).status === 200) return;
    } catch {
      /* aún no escucha */
    }
    if (Date.now() > limite) throw new Error(`el sitio no respondió en ${BASE}/api/health`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

console.log(`Prueba de humo contra ${BASE}`);
await esperarSitio();

console.log("\nDisponibilidad");
await comprobar("la salud responde ok y la base contesta", async () => {
  const r = await pedir("/api/health");
  const j = await r.json();
  exigir(r.status === 200 && j.ok === true && j.db === "ok", JSON.stringify(j));
});
let slugNota = "";
await comprobar("la portada, el sitemap y el feed responden", async () => {
  for (const ruta of ["/", "/sitemap.xml", "/feed.xml", "/robots.txt", "/politica-de-privacidad"]) {
    const r = await pedir(ruta);
    exigir(r.status === 200, `${ruta} → ${r.status}`);
    if (ruta === "/feed.xml") slugNota = (await r.text()).match(/\/articulo\/([a-z0-9-]+)/)?.[1] ?? "";
  }
});
await comprobar("una nota se sirve con su JSON-LD de NewsArticle", async () => {
  exigir(slugNota, "el feed no trae ninguna nota");
  const r = await pedir(`/articulo/${slugNota}`);
  exigir(r.status === 200, `status ${r.status}`);
  exigir((await r.text()).includes("NewsArticle"), "falta NewsArticle");
});

console.log("\nCabeceras de seguridad (H-14)");
await comprobar("la política de contenido es OBLIGATORIA y cierra objetos, base y formularios", async () => {
  const r = await pedir("/");
  const csp = r.headers.get("content-security-policy") ?? "";
  exigir(csp, "no hay cabecera Content-Security-Policy (¿solo Report-Only?)");
  for (const d of ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'"]) exigir(csp.includes(d), `falta «${d}»`);
  exigir(!csp.includes("unsafe-eval"), "admite unsafe-eval");
});
await comprobar("nosniff, HSTS y Referrer-Policy están presentes", async () => {
  const r = await pedir("/");
  exigir(r.headers.get("x-content-type-options") === "nosniff", "x-content-type-options");
  exigir((r.headers.get("strict-transport-security") ?? "").includes("max-age"), "strict-transport-security");
  exigir(r.headers.get("referrer-policy"), "referrer-policy");
});

console.log("\nPolítica de bots (H-13)");
await comprobar("un cliente HTTP genérico (curl) y un navegador automatizado NO se bloquean", async () => {
  for (const ua of ["curl/8.7.1", "python-requests/2.32.3", "Mozilla/5.0 HeadlessChrome/130.0 Safari/537.36", ""]) {
    const r = await pedir("/", { headers: { "user-agent": ua } });
    exigir(r.status === 200, `«${ua}» → ${r.status}`);
  }
});
await comprobar("un crawler de entrenamiento de IA sí se rechaza, y robots.txt lo declara", async () => {
  const r = await pedir("/", { headers: { "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)" } });
  exigir(r.status === 403, `GPTBot → ${r.status}`);
  const robots = await (await pedir("/robots.txt")).text();
  exigir(/User-Agent: GPTBot\s+Disallow: \//i.test(robots), "robots.txt no bloquea GPTBot");
});

console.log("\nAcceso (H-01, H-09, H-17)");
await comprobar("el panel exige sesión y lleva al login", async () => {
  const r = await pedir("/panel");
  exigir([302, 307, 308].includes(r.status) && (r.headers.get("location") ?? "").includes("/panel/login"), `status ${r.status} → ${r.headers.get("location")}`);
  exigir((await pedir("/panel/login")).status === 200, "el login no responde");
});
await comprobar("los cron rechazan llamadas sin secreto, también con «Bearer undefined»", async () => {
  for (const ruta of ["/api/cron/publish-scheduled", "/api/cron/sync-archive", "/api/cron/sync-market-data"]) {
    for (const headers of [{}, { authorization: "Bearer undefined" }, { authorization: "Bearer cualquiera" }]) {
      const r = await pedir(ruta, { headers });
      exigir(r.status === 401, `${ruta} con ${JSON.stringify(headers)} → ${r.status}`);
    }
  }
});
await comprobar("el webhook de Telegram rechaza lo que no trae el secreto", async () => {
  for (const headers of [{}, { "x-telegram-bot-api-secret-token": "contexto-ganadero-dev-secret" }]) {
    const r = await pedir("/api/telegram/webhook", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: "{}" });
    exigir(r.status === 401 || r.status === 503, `→ ${r.status}`);
  }
});

console.log("\nBoletín (H-10)");
await comprobar("abrir el enlace de confirmación con un GET no confirma nada y un token inválido se dice sin ambigüedad", async () => {
  const r = await pedir("/boletin/confirmar?t=0123456789abcdef0123456789");
  const html = await r.text();
  exigir(r.status === 200 && html.includes("no es válido"), "debía decir que el enlace no es válido");
  exigir(!html.includes("Suscripción confirmada"), "un GET no puede confirmar");
});

console.log("\nAsistente (H-08)");
await comprobar("sin fuentes el asistente declina y no inventa", async () => {
  const r = await pedir("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "zxqvbn plmokn qazwsx", sessionId: "smoke" }) });
  const j = await r.json();
  exigir(r.status === 200 && j.mode === "declined" && Array.isArray(j.sources) && j.sources.length === 0, JSON.stringify(j).slice(0, 200));
});
await comprobar("con fuentes responde citándolas (o degrada a mostrarlas), nunca sin ellas", async () => {
  const r = await pedir("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "precio del novillo gordo en Medellín", sessionId: "smoke" }) });
  const j = await r.json();
  exigir(r.status === 200 && j.mode !== "declined" && j.sources.length > 0, JSON.stringify(j).slice(0, 200));
  if (j.mode === "generativo") exigir(/\[\d+\]/.test(j.answer), "una respuesta generada debe citar [n]");
});

console.log("\nEndpoints públicos (H-19, H-12)");
await comprobar("las sugerencias no tratan «%» como comodín", async () => {
  const j = await (await pedir("/api/sugerencias?q=%25%25%25")).json();
  exigir(Array.isArray(j.items) && j.items.length === 0, `devolvió ${j.items?.length} titulares`);
});
await comprobar("una misma IP no suma dos lecturas de la misma nota", async () => {
  exigir(slugNota, "sin nota");
  const lectura = () => pedir("/api/vista", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.77" }, body: JSON.stringify({ slug: slugNota }) }).then((r) => r.json());
  const [a, b] = [await lectura(), await lectura()];
  exigir(a.contada === true && b.contada === false, `primera ${a.contada}, segunda ${b.contada}`);
});
await comprobar("el aviso de notas programadas responde", async () => {
  const r = await pedir("/api/programadas", { method: "POST" });
  exigir(r.status === 200 && (await r.json()).ok === true, `status ${r.status}`);
});

console.log(`\n${hechas - fallos.length} de ${hechas} comprobaciones correctas.`);
if (fallos.length) {
  console.error(`\nFALLARON ${fallos.length}:\n- ${fallos.join("\n- ")}`);
  process.exit(1);
}
