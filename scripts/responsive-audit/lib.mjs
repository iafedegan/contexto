// Banco de pruebas de adaptabilidad (responsive): Chrome real vía puppeteer-core.
// Ver README.md. Variables de entorno:
//   AUDIT_BASE_URL  (por defecto http://localhost:3000)      AUDIT_OUT   (por defecto .audit)
//   AUDIT_RUN       (etiqueta de la tanda, p. ej. antes/despues)
//   AUDIT_EMAIL / AUDIT_PASSWORD / AUDIT_TOTP_SECRET  (solo para las pantallas del panel)
//   CHROME_PATH     (ruta de Chrome si no es la habitual)
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
let puppeteer;
let generateSync;
try {
  puppeteer = require("puppeteer-core");
} catch {
  console.error("Falta puppeteer-core: ejecuta `npm i -D puppeteer-core` (no se instala con el proyecto a propósito).");
  process.exit(1);
}
({ generateSync } = require("otplib"));

export const BASE = process.env.AUDIT_BASE_URL || "http://localhost:3000";
export const RUN = process.env.AUDIT_RUN || "run";
export const OUT = path.resolve(process.env.AUDIT_OUT || ".audit");
export const DATA = path.join(OUT, "data", RUN);
export const SHOTS = path.join(DATA, "shots");
fs.mkdirSync(SHOTS, { recursive: true });
const CHROME = process.env.CHROME_PATH || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
].find((p) => fs.existsSync(p));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const UA_DESK = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
export const UA_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
export const UA_IPAD = "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

/** Catálogo de pantallas: el tipo decide el user-agent y si hay táctil (pointer: coarse). */
export const VP = {
  "280x653":   { w: 280,  h: 653,  kind: "phone" },
  "320x568": { w: 320, h: 568, kind: "phone" },
  "360x740": { w: 360, h: 740, kind: "phone" },
  "375x667": { w: 375, h: 667, kind: "phone" },
  "390x844": { w: 390, h: 844, kind: "phone" },
  "430x932": { w: 430, h: 932, kind: "phone" },
  "667x375": { w: 667, h: 375, kind: "phone-land" },
  "844x390": { w: 844, h: 390, kind: "phone-land" },
  "768x1024": { w: 768, h: 1024, kind: "tablet" },
  "820x1180": { w: 820, h: 1180, kind: "tablet" },
  "1024x768": { w: 1024, h: 768, kind: "tablet-land" },
  "1024x1366": { w: 1024, h: 1366, kind: "tablet" },
  "1280x720": { w: 1280, h: 720, kind: "desktop" },
  "1440x900": { w: 1440, h: 900, kind: "desktop" },
  "1920x1080": { w: 1920, h: 1080, kind: "desktop" },
  "2560x1440": { w: 2560, h: 1440, kind: "desktop" },
  "3440x1440": { w: 3440, h: 1440, kind: "desktop" },
};

export async function launch() {
  if (!CHROME) { console.error("No encuentro Chrome: define CHROME_PATH."); process.exit(1); }
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(150000);
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  return { browser, page };
}

export async function setVp(page, key) {
  const v = VP[key];
  const phone = v.kind.startsWith("phone");
  const tablet = v.kind.startsWith("tablet");
  await page.setUserAgent(phone ? UA_IOS : tablet ? UA_IPAD : UA_DESK);
  await page.setViewport({ width: v.w, height: v.h, deviceScaleFactor: 1, isMobile: false, hasTouch: phone || tablet });
}

/** Entra al panel con correo, clave y código TOTP (secreto en ~/.cache/fedegan-audit/secrets-admin.json). */
export async function entrar(p) {
  const sec = process.env.AUDIT_TOTP_SECRET;
  if (!sec) { console.error("Define AUDIT_TOTP_SECRET (secreto base32 del 2FA de la cuenta) para entrar al panel."); process.exit(1); }
  await p.setUserAgent(UA_DESK);
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await p.goto(BASE + "/panel/login", { waitUntil: "networkidle2" });
  await p.type('input[type="email"]', process.env.AUDIT_EMAIL || "editor@contextoganadero.com");
  await p.type('input[type="password"]', process.env.AUDIT_PASSWORD || "contexto2026");
  const i = await p.$$("form input");
  await i[2].type(generateSync({ secret: sec }));
  await Promise.all([p.waitForNavigation({ waitUntil: "networkidle2", timeout: 40000 }).catch(() => {}), p.keyboard.press("Enter")]);
  await sleep(2000);
  return p.url().includes("/panel") && !p.url().includes("/panel/login");
}

/** Si el editor de portada ofrece retomar un borrador, parte de lo publicado. */
export async function limpio(p) {
  await sleep(1500);
  const hay = await p.evaluate(() => document.body.innerText.includes("Tienes un borrador sin publicar"));
  if (hay) {
    await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => /Empezar desde lo publicado/.test(x.innerText)).click());
    await sleep(3500);
  }
}

/** Se ejecuta DENTRO de la página: devuelve las métricas de adaptabilidad. */
export function auditFn() {
  const iw = window.innerWidth, ih = window.innerHeight;
  const de = document.documentElement;
  const res = { iw, ih, sw: de.scrollWidth, bsw: document.body.scrollWidth, sh: de.scrollHeight };
  res.hscroll = de.scrollWidth > iw + 1;
  const meta = document.querySelector('meta[name="viewport"]');
  res.viewportMeta = meta ? meta.content : null;
  // «details» cerrados: su contenido no se ve (pero conserva caja): no cuenta.
  const skip = (el) => !!el.closest("nextjs-portal, script, style, noscript, #cg-hint, [data-audit-ignore]") || (!!el.closest("details:not([open])") && !el.closest("summary") && el.tagName !== "SUMMARY");
  const vis = (cs, r) => cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0.02 && r.width > 0 && r.height > 0;
  const sel = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    const c = (typeof el.className === "string" ? el.className : "").trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".");
    if (c) s += "." + c;
    return s.slice(0, 70);
  };
  const path = (el) => { const parts = []; let e = el; for (let i = 0; i < 4 && e && e !== document.body; i++, e = e.parentElement) parts.unshift(sel(e)); return parts.join(" > "); };
  const txt = (el) => (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("alt") || "").trim().replace(/\s+/g, " ").slice(0, 40);
  const hasFixedAncestor = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { if (getComputedStyle(e).position === "fixed") return true; } return false; };

  const all = [...document.body.querySelectorAll("*")];

  // 1) Elementos que se salen del ancho de la pantalla (y que nada contiene)
  const marked = new Map();
  for (const el of all) {
    if (skip(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!vis(cs, r)) continue;
    if (r.width <= 1 || r.height <= 1) continue;
    if (!(r.right > iw + 1 || r.left < -1)) continue;
    if (hasFixedAncestor(el)) continue;
    let kind = "overflow", animated = false;
    for (let p = el; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      if (pcs.transform !== "none") animated = true;
      if (p === el) continue;
      const ox = pcs.overflowX;
      if (ox === "auto" || ox === "scroll") {
        const pr = p.getBoundingClientRect();
        if (pr.right <= iw + 1 && pr.left >= -1) { kind = "scroller"; break; }
      } else if (ox === "hidden" || ox === "clip") {
        const pr = p.getBoundingClientRect();
        if (pr.width < iw - 1) { kind = "local-clip"; break; }
        kind = "clipped";
      }
    }
    if (kind === "scroller" || kind === "local-clip") continue;
    marked.set(el, { kind, animated });
  }
  const offenders = [];
  for (const [el, m] of marked) {
    if (el.parentElement && marked.has(el.parentElement)) continue;
    const r = el.getBoundingClientRect();
    const hasContent = (el.innerText || "").trim().length > 0 || !!el.querySelector("img,video,iframe,canvas,input,button,a,svg");
    const decor = !hasContent || getComputedStyle(el).pointerEvents === "none";
    offenders.push({ s: path(el), t: txt(el), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), kind: m.kind, anim: m.animated, decor });
  }
  res.offenders = offenders.slice(0, 12);
  res.offenderCount = offenders.length;
  res.offenderReal = offenders.filter((o) => !o.decor && !o.anim).length;

  // 2) Texto pequeño (mayúsculas: < 11 px; el resto: < 12 px)
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n, minFont = 999; const small = [];
  while ((n = tw.nextNode())) {
    const s = n.textContent.replace(/\s+/g, " ").trim();
    if (s.length < 2) continue;
    const p = n.parentElement; if (!p || skip(p)) continue;
    const cs = getComputedStyle(p);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.02) continue;
    const r = p.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) continue;
    const fs = parseFloat(cs.fontSize);
    if (fs < minFont) minFont = fs;
    const upper = cs.textTransform === "uppercase" || s === s.toUpperCase();
    if (fs < (upper ? 11 : 12)) small.push({ fs: +fs.toFixed(1), t: s.slice(0, 28), s: sel(p), up: upper });
  }
  res.minFont = minFont === 999 ? null : +minFont.toFixed(1);
  res.smallTextCount = small.length;
  res.smallTextLt10 = small.filter((x) => x.fs < 10).length;
  const seen = new Set(); res.smallText = small.filter((x) => { const k = x.s + x.fs; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6);

  // 3) Objetivos táctiles
  const tsel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=menuitem], [role=switch], label';
  const tiny = [], poor = [], mid = []; let inlineLinks = 0, targets = 0;
  for (const el of document.querySelectorAll(tsel)) {
    if (skip(el)) continue;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (!vis(cs, r)) continue;
    if (r.width <= 2 || r.height <= 2) continue;
    if (r.right <= 0 || r.left >= iw) continue; // fuera de pantalla (señuelos antispam, etc.): no se pueden tocar
    if (el.tagName === "LABEL" && !el.control) continue;
    if (el.tagName === "LABEL" && el.control && el.control.type !== "checkbox" && el.control.type !== "radio") continue;
    const parentTxt = (el.parentElement && el.parentElement.innerText || "").trim().length;
    const ownTxt = (el.innerText || "").trim().length;
    if (el.tagName === "A" && cs.display === "inline" && parentTxt > ownTxt + 8) { inlineLinks++; continue; }
    targets++;
    const rec = { t: txt(el), s: sel(el), w: Math.round(r.width), h: Math.round(r.height) };
    const m = Math.min(r.width, r.height);
    if (m < 24) tiny.push(rec); else if (m < 36) poor.push(rec); else if (r.width < 44 || r.height < 44) mid.push(rec);
  }
  res.targets = targets; res.inlineLinks = inlineLinks;
  res.tapTiny = tiny.length; res.tapPoor = poor.length; res.tapMid = mid.length;
  res.tapSamples = [...tiny, ...poor].slice(0, 8);

  // 4) Campos que hacen zoom en iOS (fuente < 16px)
  const zoom = [];
  for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=submit]):not([type=button]):not([type=file]):not([type=color]), textarea, select')) {
    if (skip(el)) continue;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (!vis(cs, r)) continue;
    if (parseFloat(cs.fontSize) < 16) zoom.push({ s: sel(el), fs: +parseFloat(cs.fontSize).toFixed(1), t: (el.placeholder || el.name || "").slice(0, 24) });
  }
  res.iosZoom = zoom.length; res.iosZoomSamples = zoom.slice(0, 4);

  // 5) Imágenes deformadas
  const dist = [];
  for (const img of document.images) {
    if (skip(img)) continue;
    const cs = getComputedStyle(img); const r = img.getBoundingClientRect();
    if (!vis(cs, r) || !img.complete || !img.naturalWidth) continue;
    const a = img.naturalWidth / img.naturalHeight, b = r.width / r.height;
    if (cs.objectFit === "fill" && Math.abs(a / b - 1) > 0.06 && r.width > 40) dist.push({ s: path(img), nat: img.naturalWidth + "x" + img.naturalHeight, box: Math.round(r.width) + "x" + Math.round(r.height) });
  }
  res.imgDistorted = dist.length; res.imgDistortedSamples = dist.slice(0, 3);

  // 6) Elementos fijos/pegajosos
  const fx = [];
  for (const el of all) {
    if (skip(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") continue;
    const r = el.getBoundingClientRect();
    if (!vis(cs, r) || r.height <= 1 || r.width <= 1) continue;
    if (cs.pointerEvents === "none" && !(el.innerText || "").trim()) continue;
    fx.push({ s: path(el), pos: cs.position, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height), w: Math.round(r.width) });
  }
  let topChrome = 0, botChrome = 0;
  for (const f of fx) {
    if (f.h > ih * 0.6) continue;
    if (f.top <= 2 && f.bottom > 0) topChrome = Math.max(topChrome, f.bottom);
    else if (f.bottom >= ih - 2 && f.top > ih * 0.4) botChrome = Math.max(botChrome, ih - f.top);
  }
  res.fixed = fx.slice(0, 10); res.topChrome = topChrome; res.botChrome = botChrome;
  res.chromePct = +(((topChrome + botChrome) / ih) * 100).toFixed(1);
  const fixedOnly = fx.filter((f) => f.pos === "fixed");
  const ov = [];
  for (let i = 0; i < fixedOnly.length; i++) for (let j = i + 1; j < fixedOnly.length; j++) {
    const a = fixedOnly[i], b = fixedOnly[j];
    const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const area = x * y; const min = Math.min(a.w * a.h, b.w * b.h);
    if (area > 0 && area > min * 0.2) ov.push([a.s.split(" > ").pop(), b.s.split(" > ").pop()]);
  }
  res.fixedOverlap = ov.slice(0, 4);

  // 6b) Choques entre textos (rótulos que se pisan, comparando línea por línea) y texto recortado
  const leaves = [];
  for (const el of all) {
    if (skip(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!vis(cs, r) || r.width <= 4 || r.height <= 4) continue;
    if (r.right < 0 || r.left > iw) continue;
    if (![...el.childNodes].some((n2) => n2.nodeType === 3 && n2.textContent.trim().length > 1)) continue;
    if (hasFixedAncestor(el)) continue;
    if (el.closest("[aria-hidden=true]")) continue;
    // Revelados por scroll (translateY a medio camino) y marquesinas: la posición es transitoria, no un choque real.
    let enMovimiento = false;
    for (let q = el; q && q !== document.body; q = q.parentElement) { if (getComputedStyle(q).transform !== "none") { enMovimiento = true; break; } }
    if (enMovimiento) continue;
    leaves.push({ el, r, cs });
  }
  const collisions = [];
  const boxes = leaves.map((l) => ({ ...l, rs: [...l.el.getClientRects()].filter((q) => q.width > 4 && q.height > 4) }));
  outer: for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    for (const ra of a.rs) for (const rb of b.rs) {
      const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (x <= 8 || y <= 5) continue;
      const min = Math.min(ra.width * ra.height, rb.width * rb.height);
      if (x * y > min * 0.3) {
        collisions.push({ a: sel(a.el) + " «" + txt(a.el).slice(0, 22) + "»", b: sel(b.el) + " «" + txt(b.el).slice(0, 22) + "»", x: Math.round(x), y: Math.round(y) });
        if (collisions.length >= 8) break outer;
      }
    }
  }
  res.collisions = collisions.length; res.collisionSamples = collisions.slice(0, 4);
  const clipped = [];
  for (const { el, cs } of leaves) {
    if ((cs.overflowX === "hidden" || cs.overflowX === "clip") && el.scrollWidth > el.clientWidth + 3 && cs.textOverflow !== "ellipsis" && cs.display !== "inline") clipped.push(sel(el) + " «" + txt(el).slice(0, 24) + "»");
  }
  res.clippedText = clipped.length; res.clippedTextSamples = clipped.slice(0, 4);

  // 6c) Texto cortado por una caja con overflow oculto (p. ej. un titular que crece por encima de su tarjeta)
  const cut = [];
  for (const { el, r } of leaves) {
    if (r.width <= 8 || r.height <= 8) continue;
    if (el.closest(".lx-marquee, [class*='line-clamp'], .truncate")) continue;
    let anim = false;
    for (let q = el; q && q !== document.body; q = q.parentElement) { if (getComputedStyle(q).transform !== "none") { anim = true; break; } }
    if (anim) continue;
    for (let q = el.parentElement; q && q !== document.body; q = q.parentElement) {
      const qc = getComputedStyle(q);
      if (qc.overflowX === "visible" && qc.overflowY === "visible") continue;
      // Dentro de un scroller (carrusel nativo) lo que sobra por el borde es alcanzable: no es un corte.
      if (["auto", "scroll"].includes(qc.overflowX) || ["auto", "scroll"].includes(qc.overflowY)) break;
      if (!["hidden", "clip"].includes(qc.overflowX) && !["hidden", "clip"].includes(qc.overflowY)) continue;
      const qr = q.getBoundingClientRect();
      if (qr.width <= 0) continue;
      const arriba = r.top < qr.top - 2 && r.bottom > qr.top + 2;
      const abajo = r.bottom > qr.bottom + 2 && r.top < qr.bottom - 2;
      const izq = r.left < qr.left - 2 && r.right > qr.left + 2;
      const der = r.right > qr.right + 2 && r.left < qr.right - 2;
      if (arriba || abajo || izq || der) { cut.push(sel(el) + " «" + txt(el).slice(0, 26) + "» ∩ " + sel(q)); break; }
    }
  }
  res.cutText = cut.length; res.cutTextSamples = cut.slice(0, 4);

  // 7) Contenedor principal y medida de línea
  const shell = document.querySelector(".shell");
  if (shell) { const r = shell.getBoundingClientRect(); res.shell = { w: Math.round(r.width), l: Math.round(r.left) }; }
  const p = document.querySelector("article p, .prose p, .lx-prose p");
  if (p) { const r = p.getBoundingClientRect(); const fs = parseFloat(getComputedStyle(p).fontSize); res.proseCh = Math.round(r.width / (fs * 0.5)); res.proseFs = fs; }
  res.title = document.title.slice(0, 50);
  const th = document.querySelector("[data-theme]"); res.theme = th ? th.getAttribute("data-theme") : null;
  return res;
}

export async function visit(page, url, { wait = 1200, ip = null } = {}) {
  const errs = [];
  await page.setExtraHTTPHeaders(ip ? { "x-forwarded-for": ip } : {});
  const onErr = (e) => errs.push("pageerror: " + String(e.message).slice(0, 140));
  const onCon = (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 140)); };
  page.on("pageerror", onErr); page.on("console", onCon);
  let status = null;
  try {
    let resp = await page.goto(BASE + url, { waitUntil: "load", timeout: 150000 });
    status = resp ? resp.status() : null;
    if (status === 429) { await sleep(62000); resp = await page.goto(BASE + url, { waitUntil: "load", timeout: 150000 }); status = resp ? resp.status() : null; }
  } catch (e) { errs.push("goto: " + String(e.message).slice(0, 100)); }
  await sleep(wait);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  page.off("pageerror", onErr); page.off("console", onCon);
  return { status, errs: [...new Set(errs)].slice(0, 4) };
}

/** Prueba de estrés de contenido: alarga cada titular de noticia a `n` caracteres (los titulares reales rondan los 90-150). */
export async function alargarTitulares(page, n = 130) {
  return page.evaluate((n) => {
    const extra = " según el último boletín de la Central Ganadera y los gremios regionales del Caribe y los Llanos Orientales de Colombia";
    let c = 0;
    for (const h of document.querySelectorAll("main h1, main h2, main h3, main h4")) {
      const link = h.querySelector('a[href*="/articulo/"]') || h.closest('a[href*="/articulo/"]');
      const esNota = location.pathname.includes("/articulo/") && h.tagName === "H1";
      if (!link && !esNota) continue;
      const t = h.textContent.trim().replace(/\s+/g, " ");
      if (t.length >= n) continue;
      let hoja = h;
      while (hoja.children.length === 1) hoja = hoja.firstElementChild;
      if (hoja.children.length) continue;
      hoja.textContent = (t + extra).slice(0, n);
      c++;
    }
    return c;
  }, n);
}

export const audit = (page) => page.evaluate(auditFn);
export function writeLine(file, obj) { fs.appendFileSync(file, JSON.stringify(obj) + "\n"); }
export function readLines(file) { return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []; }

/** Capturas al ritmo de un lector: una pantalla por scroll (las animaciones de entrada ya se dispararon). */
export async function filmstrip(page, base, { max = 10, wait = 650 } = {}) {
  const H = await page.evaluate(() => innerHeight);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const n = Math.max(1, Math.min(max, Math.ceil(total / H)));
  const files = [];
  for (let i = 0; i < n; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * H);
    await sleep(wait);
    const f = `${base}__f${String(i).padStart(2, "0")}.png`;
    await page.screenshot({ path: f });
    files.push(f);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return files;
}

/** Publica una plantilla desde el editor (BD local). */
export async function publicarPlantilla(page, nombre) {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.setUserAgent(UA_DESK);
  await page.goto(BASE + "/panel/portada", { waitUntil: "load" }); await sleep(5000); await limpio(page);
  await page.evaluate(() => { const d = document.getElementById("bloque-plantilla"); d.open = true; d.dispatchEvent(new Event("toggle")); }); await sleep(600);
  const ok = await page.evaluate((nombre2) => { const b = [...document.querySelectorAll("#bloque-plantilla button")].find((x) => x.innerText.includes(nombre2)); if (!b) return false; b.click(); return true; }, nombre);
  if (!ok) return false;
  await sleep(1500);
  const hay = await page.evaluate(() => !![...document.querySelectorAll("button")].find((x) => /Publicar cambios/.test(x.innerText)));
  if (!hay) return true; // ya estaba activa
  await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => /Publicar cambios/.test(x.innerText)).click()); await sleep(600);
  await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((x) => /Sí, publicar ahora/.test(x.innerText)).click()); await sleep(4000);
  return true;
}
