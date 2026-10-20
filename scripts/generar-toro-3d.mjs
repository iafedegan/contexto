// Genera public/modelos/toro.glb: la cabeza de «Toro», la mascota del sitio, en 3D (esferas, conos y un aro) con los colores de la mascota.
// Sin dependencias: arma el glTF binario a mano. Uso: node scripts/generar-toro-3d.mjs
import fs from "node:fs";

const esfera = (n = 24) => {
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const v = i / n, t = v * Math.PI;
    for (let j = 0; j <= n * 2; j++) {
      const u = j / (n * 2), p = u * Math.PI * 2;
      const x = Math.sin(t) * Math.cos(p), y = Math.cos(t), z = Math.sin(t) * Math.sin(p);
      pos.push(x, y, z); nor.push(x, y, z);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n * 2; j++) {
    const a = i * (n * 2 + 1) + j, b = a + n * 2 + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  return { pos, nor, idx };
};
// Cono de base radio 1 y altura 1 (punta arriba), con tapa.
const cono = (n = 24) => {
  const pos = [], nor = [], idx = [];
  const k = 1 / Math.SQRT2;
  for (let j = 0; j <= n; j++) {
    const p = (j / n) * Math.PI * 2, c = Math.cos(p), s = Math.sin(p);
    pos.push(c, 0, s); nor.push(c * k, k, s * k);
    pos.push(0, 1, 0); nor.push(c * k, k, s * k);
  }
  for (let j = 0; j < n; j++) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  const base = pos.length / 3;
  pos.push(0, 0, 0); nor.push(0, -1, 0);
  for (let j = 0; j <= n; j++) { const p = (j / n) * Math.PI * 2; pos.push(Math.cos(p), 0, Math.sin(p)); nor.push(0, -1, 0); }
  for (let j = 0; j < n; j++) idx.push(base, base + 2 + j, base + 1 + j);
  return { pos, nor, idx };
};
// Toro de radio mayor 1 y radio menor `r`, en el plano XZ.
const toro = (r = 0.2, n = 32, m = 14) => {
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * Math.PI * 2;
    for (let j = 0; j <= m; j++) {
      const v = (j / m) * Math.PI * 2;
      const cx = Math.cos(u), cz = Math.sin(u);
      pos.push((1 + r * Math.cos(v)) * cx, r * Math.sin(v), (1 + r * Math.cos(v)) * cz);
      nor.push(Math.cos(v) * cx, Math.sin(v), Math.cos(v) * cz);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const a = i * (m + 1) + j, b = a + m + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return { pos, nor, idx };
};

const GEOS = { esfera: esfera(), cono: cono(), toro: toro(0.16) };
const MAT = {
  piel: { c: [0.46, 0.26, 0.14], m: 0, r: 0.85 }, rosa: { c: [0.93, 0.63, 0.63], m: 0, r: 0.8 }, oscuro: { c: [0.2, 0.12, 0.1], m: 0, r: 0.7 },
  blanco: { c: [0.97, 0.97, 0.95], m: 0, r: 0.4 }, hueso: { c: [0.96, 0.9, 0.75], m: 0, r: 0.6 }, oro: { c: [0.83, 0.63, 0.09], m: 0.9, r: 0.3 },
};
const rotZ = (g) => [0, 0, Math.sin((g * Math.PI) / 360), Math.cos((g * Math.PI) / 360)];
const rotX = (g) => [Math.sin((g * Math.PI) / 360), 0, 0, Math.cos((g * Math.PI) / 360)];
// [geometría, material, posición, escala, rotación]
const PIEZAS = [
  ["esfera", "piel", [0, 0.3, 0], [0.26, 0.24, 0.23]],            // cabeza
  ["esfera", "rosa", [0, 0.19, 0.17], [0.15, 0.105, 0.1]],        // hocico
  ["esfera", "oscuro", [-0.055, 0.2, 0.262], [0.024, 0.03, 0.012]], ["esfera", "oscuro", [0.055, 0.2, 0.262], [0.024, 0.03, 0.012]], // fosas
  ["toro", "oro", [0, 0.125, 0.255], [0.034, 0.034, 0.034], rotX(90)], // argolla
  ["esfera", "blanco", [-0.095, 0.36, 0.17], [0.065, 0.07, 0.045]], ["esfera", "blanco", [0.095, 0.36, 0.17], [0.065, 0.07, 0.045]], // ojos
  ["esfera", "oscuro", [-0.095, 0.36, 0.205], [0.034, 0.038, 0.02]], ["esfera", "oscuro", [0.095, 0.36, 0.205], [0.034, 0.038, 0.02]], // pupilas
  ["esfera", "blanco", [-0.083, 0.375, 0.222], [0.01, 0.01, 0.008]], ["esfera", "blanco", [0.107, 0.375, 0.222], [0.01, 0.01, 0.008]], // brillo
  ["esfera", "oscuro", [-0.1, 0.44, 0.175], [0.07, 0.014, 0.03], rotZ(-12)], ["esfera", "oscuro", [0.1, 0.44, 0.175], [0.07, 0.014, 0.03], rotZ(12)], // cejas
  ["esfera", "piel", [-0.29, 0.3, -0.01], [0.085, 0.055, 0.04], rotZ(25)], ["esfera", "piel", [0.29, 0.3, -0.01], [0.085, 0.055, 0.04], rotZ(-25)], // orejas
  ["esfera", "rosa", [-0.295, 0.3, 0.012], [0.055, 0.035, 0.02], rotZ(25)], ["esfera", "rosa", [0.295, 0.3, 0.012], [0.055, 0.035, 0.02], rotZ(-25)], // interior
  ["cono", "hueso", [-0.17, 0.46, 0], [0.05, 0.2, 0.05], rotZ(38)], ["cono", "hueso", [0.17, 0.46, 0], [0.05, 0.2, 0.05], rotZ(-38)], // cuernos
  ["esfera", "hueso", [0, 0.535, 0.1], [0.055, 0.04, 0.045]],      // mechón
];

const bin = [], vistas = [], accesores = [], mallas = [], nodos = [], materiales = [];
const relleno = () => { while (bin.length % 4) bin.push(0); };
const agregar = (arr, tipo) => {
  relleno();
  const buf = Buffer.alloc(arr.length * 4);
  arr.forEach((v, i) => (tipo === "f" ? buf.writeFloatLE(v, i * 4) : buf.writeUInt32LE(v, i * 4)));
  const ini = bin.length; bin.push(...buf);
  vistas.push({ buffer: 0, byteOffset: ini, byteLength: buf.length, target: tipo === "f" ? 34962 : 34963 });
  return vistas.length - 1;
};
const geoAcc = {};
for (const [k, g] of Object.entries(GEOS)) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < g.pos.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], g.pos[i + a]); mx[a] = Math.max(mx[a], g.pos[i + a]); }
  const vp = agregar(g.pos, "f"), vn = agregar(g.nor, "f"), vi = agregar(g.idx, "i");
  accesores.push({ bufferView: vp, componentType: 5126, count: g.pos.length / 3, type: "VEC3", min: mn, max: mx }); const ap = accesores.length - 1;
  accesores.push({ bufferView: vn, componentType: 5126, count: g.nor.length / 3, type: "VEC3" }); const an = accesores.length - 1;
  accesores.push({ bufferView: vi, componentType: 5125, count: g.idx.length, type: "SCALAR" }); const ai = accesores.length - 1;
  geoAcc[k] = { ap, an, ai };
}
const matIdx = {};
for (const [k, m] of Object.entries(MAT)) { matIdx[k] = materiales.length; materiales.push({ name: k, pbrMetallicRoughness: { baseColorFactor: [...m.c, 1], metallicFactor: m.m, roughnessFactor: m.r } }); }
const mallaIdx = {};
PIEZAS.forEach(([g, m, t, s, r], i) => {
  const key = `${g}-${m}`;
  if (mallaIdx[key] === undefined) { mallaIdx[key] = mallas.length; mallas.push({ name: key, primitives: [{ attributes: { POSITION: geoAcc[g].ap, NORMAL: geoAcc[g].an }, indices: geoAcc[g].ai, material: matIdx[m] }] }); }
  nodos.push({ name: `${g}${i}`, mesh: mallaIdx[key], translation: t, scale: s, ...(r ? { rotation: r } : {}) });
});
// La cabeza se apoya en el suelo (y = 0) y se centra para la realidad aumentada.
const raiz = { name: "Toro", children: nodos.map((_, i) => i), translation: [0, 0, 0] };
nodos.push(raiz);
const json = { asset: { version: "2.0", generator: "CONtexto Ganadero · generar-toro-3d.mjs" }, scene: 0, scenes: [{ nodes: [nodos.length - 1] }], nodes: nodos, meshes: mallas, materials: materiales, accessors: accesores, bufferViews: vistas, buffers: [{ byteLength: 0 }] };
relleno();
json.buffers[0].byteLength = bin.length;
let js = Buffer.from(JSON.stringify(json));
while (js.length % 4) js = Buffer.concat([js, Buffer.from(" ")]);
const bb = Buffer.from(bin);
const cab = Buffer.alloc(12); cab.write("glTF", 0); cab.writeUInt32LE(2, 4); cab.writeUInt32LE(12 + 8 + js.length + 8 + bb.length, 8);
const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.write("JSON", 4);
const c2 = Buffer.alloc(8); c2.writeUInt32LE(bb.length, 0); c2.write("BIN\0", 4);
fs.writeFileSync("public/modelos/toro.glb", Buffer.concat([cab, c1, js, c2, bb]));
console.log("public/modelos/toro.glb", Math.round((cab.length + 16 + js.length + bb.length) / 1024), "KB");
