/**
 * Genera `src/lib/mundo-mapa.ts`: los países del mundo como trazos SVG simplificados, para el mapa «Desde dónde · El mundo» del
 * centro de análisis. Fuente: Natural Earth, Admin 0 – Countries 1:110m (dominio público).
 *
 *   node scripts/generar-mapa-mundo.mjs [ruta-o-url-del-geojson]
 *
 * Sin dependencias: proyección equirectangular (se recorta la Antártida, que no lee nadie y ocuparía un tercio del dibujo), simplificación
 * Ramer–Douglas–Peucker y un decimal. La clave de cada país es su código ISO 3166-1 alfa-2, el mismo que da la cabecera
 * `x-vercel-ip-country` y que se guarda en `reader_sessions.country`.
 */
import { readFileSync, writeFileSync } from "node:fs";

const ORIGEN = process.argv[2] ?? "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";
const TOLERANCIA = 0.25; // grados: invisible a 640 px de ancho
const ANCHO = 640;
const LAT_MAX = 84;
const LAT_MIN = -57;

const geo = ORIGEN.startsWith("http") ? await fetch(ORIGEN).then((r) => r.json()) : JSON.parse(readFileSync(ORIGEN, "utf8"));

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

// Un anillo cerrado empieza y termina en el mismo punto: se parte en el vértice más lejano del primero y se simplifica cada mitad.
function rdpAnillo(anillo, e) {
  let k = 0, max = -1;
  for (let i = 1; i < anillo.length; i++) {
    const d = Math.hypot(anillo[i][0] - anillo[0][0], anillo[i][1] - anillo[0][1]);
    if (d > max) { max = d; k = i; }
  }
  return [...rdp(anillo.slice(0, k + 1), e).slice(0, -1), ...rdp(anillo.slice(k), e)];
}

const escala = ANCHO / 360;
const ALTO = Math.round((LAT_MAX - LAT_MIN) * escala);
const px = ([lon, lat]) => [Math.round((lon + 180) * escala * 10) / 10, Math.round((LAT_MAX - Math.max(LAT_MIN, Math.min(LAT_MAX, lat))) * escala * 10) / 10];

// Natural Earth dibuja la Guayana Francesa dentro de Francia; la geolocalización la da como país propio (GF): se separa.
const features = geo.features.flatMap((f) => {
  if (f.properties.ADM0_A3 !== "FRA" || f.geometry.type !== "MultiPolygon") return [f];
  const enAmerica = (poli) => poli[0].reduce((s, q) => s + q[0], 0) / poli[0].length < -20;
  return [
    { ...f, geometry: { type: "MultiPolygon", coordinates: f.geometry.coordinates.filter((p) => !enAmerica(p)) } },
    { properties: { ...f.properties, ISO_A2: "GF", NAME_ES: "Guayana Francesa", ISO_A3: "GUF" }, geometry: { type: "MultiPolygon", coordinates: f.geometry.coordinates.filter(enAmerica) } },
  ];
});

const paises = features
  .filter((f) => f.properties.ISO_A3 !== "ATA")
  .map((f) => {
    const p = f.properties;
    const iso = p.ISO_A2 !== "-99" ? p.ISO_A2 : p.ISO_A2_EH !== "-99" ? p.ISO_A2_EH : null;
    const poligonos = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    let d = "";
    let mayor = null;
    for (const poli of poligonos) {
      const anillo = rdpAnillo(poli[0], TOLERANCIA);
      if (anillo.length < 3) continue;
      const pts = anillo.map(px);
      d += "M" + pts.map((q) => `${q[0]} ${q[1]}`).join("L") + "Z";
      if (!mayor || poli[0].length > mayor.length) mayor = poli[0];
    }
    // Un punto dentro del polígono mayor (promedio de sus vértices), para anclar el círculo de los países diminutos.
    const c = mayor ? px([mayor.reduce((s, q) => s + q[0], 0) / mayor.length, mayor.reduce((s, q) => s + q[1], 0) / mayor.length]) : [0, 0];
    return { iso, nombre: p.NAME_ES || p.NAME, d, c };
  })
  .filter((x) => x.iso && x.d)
  .sort((a, b) => a.iso.localeCompare(b.iso));

const salida = `/**
 * Países del mundo como trazos SVG simplificados (lienzo de ${ANCHO} × ${ALTO}, equirectangular, sin la Antártida). GENERADO por
 * \`node scripts/generar-mapa-mundo.mjs\` a partir de Natural Earth (1:110m, dominio público); no se edita a mano.
 * \`iso\` es el código ISO 3166-1 alfa-2 (el de \`reader_sessions.country\`); \`c\` es un punto dentro del país.
 */
export const MUNDO_ANCHO = ${ANCHO};
export const MUNDO_ALTO = ${ALTO};
/** Proyecta [longitud, latitud] al lienzo (para ubicar los países que el mapa a esta escala no dibuja). */
export const proyectarMundo = (lon: number, lat: number): [number, number] => [(lon + 180) * ${escala}, (${LAT_MAX} - Math.max(${LAT_MIN}, Math.min(${LAT_MAX}, lat))) * ${escala}];
export const PAISES: { iso: string; nombre: string; d: string; c: [number, number] }[] = [
${paises.map((x) => "  " + JSON.stringify(x)).join(",\n")},
];
`;
writeFileSync(new URL("../src/lib/mundo-mapa.ts", import.meta.url), salida);
console.log(`${paises.length} países · ${Math.round(salida.length / 1024)} KB`);
