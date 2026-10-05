import fs from "node:fs"; import path from "node:path";
// uso: node scripts/responsive-audit/report.mjs <tanda> <archivo.ndjson> [summary|detail]
const [run, name, mode = "summary"] = process.argv.slice(2);
// Archivo de resultados a resumir.
const file = path.join(path.resolve(process.env.AUDIT_OUT || ".audit"), "data", run, name);
// Filas de resultados con auditoría.
const rows = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.a);
// Orden en que se muestran los tamaños de pantalla.
const order = ["320x568","360x740","375x667","390x844","430x932","667x375","844x390","768x1024","820x1180","1024x768","1024x1366","1280x720","1440x900","1920x1080","2560x1440"];
rows.sort((x, y) => x.route.localeCompare(y.route) || order.indexOf(x.vp) - order.indexOf(y.vp));
if (mode === "summary") {
  console.log("ruta".padEnd(18), "pantalla".padEnd(10), "hscr", "desb", "choq", "clip", "corte", "minF", "txt", "tapT", "tapP", "ios", "chr%");
  for (const r of rows) { const a = r.a; console.log(r.route.padEnd(18), r.vp.padEnd(10), String(a.hscroll ? "SI" : "").padEnd(4), String(a.offenderReal).padEnd(4), String(a.collisions ?? "").padEnd(4), String(a.clippedText ?? "").padEnd(4), String(a.cutText ?? "").padEnd(5), String(a.minFont).padEnd(4), String(a.smallTextCount).padEnd(3), String(a.tapTiny).padEnd(4), String(a.tapPoor).padEnd(4), String(a.iosZoom).padEnd(3), a.chromePct); }
}
if (mode === "detail") {
  const seen = new Set();
  for (const r of rows) { const a = r.a;
    for (const c of a.collisionSamples ?? []) { const k = "C" + r.route + c.a.slice(0, 40) + c.b.slice(0, 40); if (!seen.has(k)) { seen.add(k); console.log("CHOQUE", r.route, r.vp, JSON.stringify(c)); } }
    for (const c of a.cutTextSamples ?? []) { const k = "X" + r.route + c.slice(0, 60); if (!seen.has(k)) { seen.add(k); console.log("CORTE", r.route, r.vp, c); } }
    for (const c of a.clippedTextSamples ?? []) { const k = "T" + r.route + c.slice(0, 50); if (!seen.has(k)) { seen.add(k); console.log("RECORTE", r.route, r.vp, c); } }
    for (const o of a.offenders) { if (o.decor || o.anim) continue; const k = "O" + r.route + o.s.slice(-50); if (!seen.has(k)) { seen.add(k); console.log("DESBORDE", r.route, r.vp, o.kind, `[${o.l}..${o.r}]`, o.s.slice(-90), "«" + o.t + "»"); } } }
}
