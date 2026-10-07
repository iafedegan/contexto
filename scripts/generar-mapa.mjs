/**
 * Genera `src/lib/colombia-mapa.ts`: los departamentos de Colombia como trazos SVG simplificados, para el mapa de los
 * indicadores ganaderos. Fuente: Marco Geoestadístico Nacional del DANE (2018), datos abiertos.
 *
 *   node scripts/generar-mapa.mjs [ruta-o-url-del-geojson]
 *
 * Sin dependencias: proyecta (longitud × cos de la latitud media), simplifica con Ramer–Douglas–Peucker y redondea a un
 * decimal. San Andrés y Providencia se omiten (están a 700 km de la costa y descuadrarían el dibujo).
 */
import { writeFileSync } from "node:fs";

const ORIGEN = process.argv[2] ?? "https://raw.githubusercontent.com/caticoa3/colombia_mapa/master/co_2018_MGN_DPTO_POLITICO.geojson";
const TOLERANCIA = 0.014; // grados: ~1,5 km, invisible a 300 px de ancho
const ANCHO = 300;

const sinTildes = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
const geo = await (ORIGEN.startsWith("http") ? fetch(ORIGEN).then((r) => r.json()) : import("node:fs").then((f) => JSON.parse(f.readFileSync(ORIGEN, "utf8"))));

// Ramer–Douglas–Peucker sobre un anillo de [lon, lat].
function rdp(p, e) {
  if (p.length < 3) return p;
  const [a, b] = [p[0], p[p.length - 1]];
  let max = 0, k = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const d = Math.abs((b[0] - a[0]) * (a[1] - p[i][1]) - (a[0] - p[i][0]) * (b[1] - a[1])) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9);
    if (d > max) { max = d; k = i; }
  }
  return max > e ? [...rdp(p.slice(0, k + 1), e).slice(0, -1), ...rdp(p.slice(k), e)] : [a, b];
}

const deptos = geo.features
  .filter((f) => !/SAN ANDR/i.test(f.properties.DPTO_CNMBR))
  .map((f) => ({
    nombre: sinTildes(f.properties.DPTO_CNMBR).replace(/^SANTAFE DE BOGOTA.*/, "BOGOTA D.C."),
    anillos: (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).map((poli) => poli[0]),
  }));

const todos = deptos.flatMap((d) => d.anillos.flat());
const lon0 = Math.min(...todos.map((p) => p[0])), lon1 = Math.max(...todos.map((p) => p[0]));
const lat0 = Math.min(...todos.map((p) => p[1])), lat1 = Math.max(...todos.map((p) => p[1]));
const k = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
const escala = ANCHO / ((lon1 - lon0) * k);
const alto = Math.round((lat1 - lat0) * escala);
const X = (lon) => +((lon - lon0) * k * escala).toFixed(1);
const Y = (lat) => +((lat1 - lat) * escala).toFixed(1);

const salida = deptos.map((d) => {
  let sx = 0, sy = 0, mejor = 0;
  const trazo = d.anillos
    .map((a) => {
      // Un anillo cierra sobre sí mismo (primer punto = último): se parte por el punto más lejano del inicio.
      let j = 1;
      for (let i = 2; i < a.length - 1; i++) if (Math.hypot(a[i][0] - a[0][0], a[i][1] - a[0][1]) > Math.hypot(a[j][0] - a[0][0], a[j][1] - a[0][1])) j = i;
      const s = [...rdp(a.slice(0, j + 1), TOLERANCIA).slice(0, -1), ...rdp(a.slice(j), TOLERANCIA)];
      if (s.length < 4) return "";
      // El centro del anillo mayor (el continente del departamento) sirve de ancla para etiquetas.
      let area = 0;
      for (let i = 0; i < s.length - 1; i++) area += s[i][0] * s[i + 1][1] - s[i + 1][0] * s[i][1];
      if (Math.abs(area) > mejor) { mejor = Math.abs(area); sx = s.reduce((t, p) => t + X(p[0]), 0) / s.length; sy = s.reduce((t, p) => t + Y(p[1]), 0) / s.length; }
      return "M" + s.map((p) => `${X(p[0])} ${Y(p[1])}`).join("L") + "Z";
    })
    .join("");
  return { nombre: d.nombre, d: trazo, c: [+sx.toFixed(1), +sy.toFixed(1)] };
});

const ts = `/**
 * Departamentos de Colombia como trazos SVG simplificados (lienzo de ${ANCHO} × ${alto}). GENERADO por
 * \`node scripts/generar-mapa.mjs\` a partir del Marco Geoestadístico Nacional del DANE (2018); no se edita a mano.
 * \`c\` es un punto dentro del departamento, para anclar etiquetas.
 */
export const MAPA_ANCHO = ${ANCHO};
export const MAPA_ALTO = ${alto};
export const DEPARTAMENTOS: { nombre: string; d: string; c: [number, number] }[] = ${JSON.stringify(salida, null, 1).replace(/\n\s*/g, " ").replace(/\}, \{/g, "},\n  {").replace(/^\[ /, "[\n  ").replace(/ \]$/, "\n]")};
`;
writeFileSync("src/lib/colombia-mapa.ts", ts);
console.log(`${salida.length} departamentos, ${(ts.length / 1024).toFixed(1)} KB, lienzo ${ANCHO}x${alto}`);
