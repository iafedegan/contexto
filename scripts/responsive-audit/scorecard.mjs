// Resumen por tipo de pantalla. Uso: node scripts/responsive-audit/scorecard.mjs <tanda> "<etiqueta>" <archivo.ndjson>[,<archivo>...]
import fs from "node:fs";
import path from "node:path";
const [run, label, files] = process.argv.slice(2);
const dir = path.join(path.resolve(process.env.AUDIT_OUT || ".audit"), "data", run);
const rows = files.split(",").flatMap((f) => fs.readFileSync(path.join(dir, f), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))).filter((r) => r.a);
const clase = (vp) => { const [w, h] = vp.split("x").map(Number); return w <= 430 || (w <= 932 && h <= 430) ? "movil" : w <= 1024 ? "tableta" : "escritorio"; };
const mean = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : 0);
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
console.log(`## ${label}: ${rows.length} vistas medidas`);
console.log("grupo".padEnd(11), "n".padStart(4), "desbord".padStart(7), "cortes".padStart(6), "choques".padStart(7), "txt peq.".padStart(8), "tap<24".padStart(6), "tap<36".padStart(6), "iosZoom".padStart(7), "chrome% med".padStart(11), "chrome% max".padStart(11));
for (const g of ["movil", "tableta", "escritorio"]) {
  const rs = rows.filter((r) => clase(r.vp) === g); if (!rs.length) continue;
  const ch = rs.filter((r) => r.route !== "api-docs").map((r) => (r.scrolled || r.a).chromePct); // la documentación (Scalar) tiene su propia barra lateral fija
  if (!ch.length) ch.push(0);
  console.log(g.padEnd(11), String(rs.length).padStart(4), String(rs.filter((r) => r.a.offenderReal > 0 || r.a.hscroll).length).padStart(7), String(rs.filter((r) => (r.a.cutText || 0) > 0).length).padStart(6), String(rs.filter((r) => (r.a.collisions || 0) > 0).length).padStart(7),
    String(mean(rs.map((r) => r.a.smallTextCount))).padStart(8), String(mean(rs.map((r) => r.a.tapTiny))).padStart(6), String(mean(rs.map((r) => r.a.tapTiny + r.a.tapPoor))).padStart(6), String(mean(rs.map((r) => r.a.iosZoom))).padStart(7), String(med(ch)).padStart(11), String(Math.max(...ch)).padStart(11));
}
