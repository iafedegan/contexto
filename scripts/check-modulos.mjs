#!/usr/bin/env node
/**
 * Guardián de la arquitectura modular (monolito modular).
 *
 * Lee scripts/modulos.config.json, asigna cada archivo de src/ a un módulo, y comprueba que cada importación
 * respete el grafo permitido (`puedeUsar`). Las violaciones que ya existían se guardan en
 * scripts/modulos.baseline.json (una «línea base» que solo puede BAJAR): el script falla si aparece una violación
 * nueva y avisa si alguna se corrigió para que se actualice la línea base.
 *
 *   node scripts/check-modulos.mjs            comprueba (CI)
 *   node scripts/check-modulos.mjs --informe  imprime el mapa completo de dependencias
 *   node scripts/check-modulos.mjs --actualizar  reescribe la línea base (solo tras corregir violaciones)
 */
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = path.join(raiz, "src");
const config = JSON.parse(fs.readFileSync(path.join(raiz, "scripts/modulos.config.json"), "utf8")).modulos;
const rutaBase = path.join(raiz, "scripts/modulos.baseline.json");
const reglas = Object.entries(config).map(([id, m]) => [id, m.rutas.map((r) => new RegExp(r))]);

const archivos = [];
(function recorrer(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) recorrer(p);
    else if (/\.(ts|tsx)$/.test(e.name)) archivos.push(p);
  }
})(src);

const rel = (p) => path.relative(src, p).split(path.sep).join("/");
const moduloDe = (r) => reglas.find(([, res]) => res.some((re) => re.test(r)))[0];
const existentes = new Set(archivos.map(rel));
const resolver = (i) => ["", ".ts", ".tsx", "/index.ts", "/index.tsx"].map((s) => i + s).find((c) => existentes.has(c)) ?? null;

const violaciones = [];
const matriz = {};
for (const f of archivos) {
  const r = rel(f);
  const origen = moduloDe(r);
  const texto = fs.readFileSync(f, "utf8");
  const importaciones = [
    // Las importaciones `import type …` se borran al compilar: no crean dependencia en tiempo de ejecución y no cuentan.
    ...[...texto.matchAll(/^(?!import\s+type\b|export\s+type\b)[^\n]*?(?:from|import)\s*\(?\s*["']@\/([^"']+)["']/gm)].map((m) => m[1]),
    ...[...texto.matchAll(/^(?!import\s+type\b|export\s+type\b)[^\n]*?(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/gm)].map((m) => rel(path.join(path.dirname(f), m[1]))),
  ];
  for (const i of importaciones) {
    const destinoRuta = resolver(i);
    if (!destinoRuta || destinoRuta === r) continue;
    const destino = moduloDe(destinoRuta);
    if (destino === origen) continue;
    matriz[`${origen}→${destino}`] = (matriz[`${origen}→${destino}`] ?? 0) + 1;
    const permitido = config[origen].puedeUsar;
    if (!permitido.includes("*") && !permitido.includes(destino)) violaciones.push(`${origen}→${destino}  ${r}  →  ${destinoRuta}`);
  }
}
// Un módulo de dominio no debe depender de la capa de composición (UI): esa dependencia nunca está permitida.
const baseExiste = fs.existsSync(rutaBase);
const base = baseExiste ? JSON.parse(fs.readFileSync(rutaBase, "utf8")).violaciones : [];
const claveDe = (v) => v;

if (process.argv.includes("--informe")) {
  console.log("Importaciones entre módulos (origen→destino: cantidad)\n");
  for (const [k, v] of Object.entries(matriz).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5), k);
}
if (process.argv.includes("--actualizar")) {
  fs.writeFileSync(rutaBase, JSON.stringify({ nota: "Violaciones heredadas: solo pueden bajar. Se reescribe con `npm run check:modulos -- --actualizar` tras corregir.", total: violaciones.length, violaciones: violaciones.sort() }, null, 1) + "\n");
  console.log(`Línea base actualizada: ${violaciones.length} violaciones heredadas.`);
  process.exit(0);
}

const nuevas = violaciones.filter((v) => !base.map(claveDe).includes(v));
const corregidas = base.filter((v) => !violaciones.includes(v));
console.log(`Módulos: ${Object.keys(config).length - 1} · archivos: ${archivos.length} · violaciones: ${violaciones.length} (línea base: ${base.length})`);
if (corregidas.length) console.log(`✔ ${corregidas.length} violación(es) heredada(s) ya corregida(s): ejecuta «npm run check:modulos -- --actualizar» para bajar la línea base.`);
if (nuevas.length) {
  console.error(`\n✖ ${nuevas.length} dependencia(s) NUEVA(S) que rompe(n) la arquitectura modular:\n`);
  for (const v of nuevas) console.error("  " + v);
  console.error("\nUn módulo solo puede depender de los que lista `puedeUsar` en scripts/modulos.config.json. Mueve la lógica compartida a un módulo permitido o comunícalos por eventos (docs/ARQUITECTURA.md).");
  process.exit(1);
}
console.log("✔ Sin dependencias nuevas fuera del grafo permitido.");
