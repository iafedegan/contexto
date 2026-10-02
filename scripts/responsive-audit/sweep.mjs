// Uso: AUDIT_RUN=antes AUDIT_BASE_URL=http://localhost:3000 node scripts/responsive-audit/sweep.mjs .audit/specs/<archivo>.json
import fs from "node:fs";
import path from "node:path";
import { launch, entrar, setVp, visit, audit, alargarTitulares, writeLine, readLines, sleep, publicarPlantilla, filmstrip, DATA, SHOTS } from "./lib.mjs";

const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = path.join(DATA, `${spec.name}.ndjson`);
if (!spec.append && !spec.resume) fs.writeFileSync(out, "");
const done = new Set(spec.resume ? readLines(out).filter((r) => r.a).map((r) => r.route + "|" + r.vp) : []);
const shotSet = new Set((spec.shots || []).map((s) => s.route + "@" + s.vp));
const shotAll = spec.shotAll === true;

let browser, page;
async function start() {
  if (browser) { try { await browser.close(); } catch {} }
  ({ browser, page } = await launch());
  if (spec.auth) {
    let ok = false;
    for (let i = 0; i < 4 && !ok; i++) {
      ok = await entrar(page);
      if (!ok) { console.log("login fallido, reintento en 35 s"); await sleep(35000); }
    }
    if (!ok) { console.log("NO SE PUDO ENTRAR"); process.exit(1); }
  }
}
await start();
if (spec.template && !spec.resume) {
  const ok = await publicarPlantilla(page, spec.template);
  console.log("plantilla", spec.template, ok ? "publicada" : "NO ENCONTRADA");
}

async function autoScroll() {
  await page.evaluate(async () => {
    await new Promise((res) => { let y = 0; const step = () => { window.scrollBy(0, 700); y += 700; if (y < document.documentElement.scrollHeight && y < 30000) setTimeout(step, 60); else res(); }; step(); });
  });
  await sleep(500);
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
}

async function one(route, vpKey, ri, vi) {
  await setVp(page, vpKey);
  const v = await visit(page, route.url, { wait: route.wait ?? 1300, ip: `10.${spec.ipBase ?? 1}.${ri}.${vi}` });
  // Pestañas de Configuración: se elige por texto (un cambio de #hash no recarga la página).
  if (route.click) {
    await page.evaluate((txt) => { const b = [...document.querySelectorAll('[role="tab"]')].find((x) => x.innerText.includes(txt)); if (b) b.click(); }, route.click);
    await sleep(700);
  }
  if (spec.stressTitles) { try { await alargarTitulares(page, spec.stressTitles); await sleep(400); } catch (e) { if (/closed|crash|Target/i.test(String(e.message))) throw e; } }
  let a = null, scrolled = null, err = null, shot = null;
  try {
    a = await audit(page);
    await page.evaluate(() => window.scrollTo(0, 900)); await sleep(500);
    const b = await audit(page);
    scrolled = { topChrome: b.topChrome, botChrome: b.botChrome, chromePct: b.chromePct, fixed: b.fixed.slice(0, 6), fixedOverlap: b.fixedOverlap, hscroll: b.hscroll };
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
  } catch (e) { err = String(e.message).slice(0, 120); if (/closed|crash|Target/i.test(err)) throw e; }
  const key = route.id + "@" + vpKey;
  if (shotAll || shotSet.has(key)) {
    try {
      await autoScroll();
      shot = path.join(SHOTS, `${spec.name}__${route.id}__${vpKey}`);
      await filmstrip(page, shot, { max: spec.maxFrames ?? 10 });
    } catch (e) { err = (err || "") + " shot:" + String(e.message).slice(0, 60); if (/closed|crash|Target/i.test(String(e.message))) throw e; }
  }
  if (spec.auth && /\/panel\/login/.test(page.url()) && !/login/.test(route.url)) err = (err || "") + " redirigido-a-login";
  writeLine(out, { theme: spec.theme || null, route: route.id, url: route.url, vp: vpKey, status: v.status, errs: v.errs, err, a, scrolled, shot });
}

let ri = 0, n = 0; const total = spec.routes.length * spec.vps.length; const t0 = Date.now();
for (const route of spec.routes) {
  ri++; let vi = 0;
  for (const vpKey of spec.vps) {
    vi++; n++;
    if (done.has(route.id + "|" + vpKey)) continue;
    for (let intento = 0; intento < 3; intento++) {
      try { await one(route, vpKey, ri, vi); break; }
      catch (e) {
        console.log(`fallo ${route.id}@${vpKey} (intento ${intento + 1}): ${String(e.message).slice(0, 80)} -> relanzo Chrome`);
        await start();
        if (intento === 2) writeLine(out, { theme: spec.theme || null, route: route.id, url: route.url, vp: vpKey, status: null, errs: [], err: "chrome-caido", a: null, scrolled: null, shot: null });
      }
    }
    if (n % 10 === 0) console.log(`${n}/${total} ${(Date.now() - t0) / 1000 | 0}s`);
  }
}
try { await browser.close(); } catch {}
console.log("listo", out);
