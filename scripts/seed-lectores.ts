/**
 * Siembra lecturas SINTÉTICAS en la base local para ver el centro de análisis del panel con volumen (hora pico, celular,
 * ciudades, orígenes…). Solo para desarrollo: se niega a correr contra una base remota y deja todo marcado como de prueba
 * (visitantes con el prefijo `00000000-…`). Borrar: `npx tsx scripts/seed-lectores.ts --limpiar`.
 *
 *   npx tsx scripts/seed-lectores.ts            ~6 000 lecturas de los últimos 60 días y ~400 suscriptores de prueba (correos «prueba-seed-N@…»; nunca se les envía nada)
 */
import "dotenv/config";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";

if (process.env.DATABASE_URL || process.env.DATABASE_URL_POOLED) {
  console.error("Esto es solo para la base local (PGlite): hay una base remota configurada, no se hace nada.");
  process.exit(1);
}

// Generador pseudoaleatorio con semilla, para que la siembra sea repetible.
let semilla = 20261006;
const azar = () => ((semilla = (semilla * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const elegir = <T,>(pesos: [T, number][]) => {
  const total = pesos.reduce((t, [, p]) => t + p, 0);
  let r = azar() * total;
  for (const [v, p] of pesos) if ((r -= p) <= 0) return v;
  return pesos[0][0];
};
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function main() {
  const db = new PGlite(`${process.cwd()}/.pglite`, { extensions: { vector } });
  await db.waitReady;
  if (process.argv.includes("--limpiar")) {
    const r = await db.query("delete from reader_sessions where visitor_id::text like '00000000-0000-4000-8000-%' returning 1");
    const u = await db.query("delete from newsletter_subscribers where email like 'prueba-seed-%' returning 1");
    console.log("lecturas de prueba borradas:", r.rows.length, "· suscriptores de prueba:", u.rows.length);
    return db.close();
  }
  const notas = (await db.query<{ id: string }>("select id from articles where status = 'publicado'")).rows.map((r) => r.id);
  if (!notas.length) throw new Error("No hay notas publicadas: corre `npm run db:local:reset`.");
  // Popularidad desigual: unas pocas notas concentran la lectura.
  const pesoNota = notas.map((id, i) => [id, 1 / (i + 1) ** 0.8] as [string, number]);
  const ciudades: [{ city: string; region: string }, number][] = [
    [{ city: "Bogotá", region: "DC" }, 34], [{ city: "Medellín", region: "ANT" }, 16], [{ city: "Cali", region: "VAC" }, 8], [{ city: "Barranquilla", region: "ATL" }, 6],
    [{ city: "Montería", region: "COR" }, 7], [{ city: "Villavicencio", region: "MET" }, 7], [{ city: "Yopal", region: "CAS" }, 4], [{ city: "Bucaramanga", region: "SAN" }, 5],
    [{ city: "Valledupar", region: "CES" }, 5], [{ city: "Cartagena", region: "BOL" }, 4], [{ city: "Montería", region: "COR" }, 2], [{ city: "Neiva", region: "HUI" }, 2],
  ];
  const fuentes: [string, number][] = [["Google", 38], ["Directo", 22], ["WhatsApp", 14], ["Facebook", 10], ["UTM · boletin / email", 9], ["Google Noticias / Discover", 5], ["X (Twitter)", 2]];
  const disp: [{ device: string; browser: string; os: string }, number][] = [
    [{ device: "mobile", browser: "Chrome", os: "Android" }, 40], [{ device: "mobile", browser: "Safari", os: "iOS" }, 22], [{ device: "desktop", browser: "Chrome", os: "Windows" }, 18],
    [{ device: "desktop", browser: "Edge", os: "Windows" }, 6], [{ device: "desktop", browser: "Safari", os: "macOS" }, 5], [{ device: "tablet", browser: "Safari", os: "iOS" }, 5], [{ device: "mobile", browser: "Samsung", os: "Android" }, 4],
  ];
  // Horas con más lectura: primera hora de la mañana, el almuerzo y la noche (hora de Colombia).
  const horas: [number, number][] = Array.from({ length: 24 }, (_, h) => [h, [1, 1, 1, 1, 1, 2, 5, 11, 14, 10, 8, 8, 9, 7, 6, 6, 6, 7, 8, 9, 10, 9, 5, 2][h]]);
  const visitantes = 1800;
  let n = 0;
  const filas: string[] = [];
  const vistos = new Set<number>();
  for (let i = 0; i < 6000; i++) {
    const dias = Math.floor(azar() ** 1.4 * 60); // más lectura reciente
    const fecha = new Date(Date.now() - dias * 86_400_000);
    const dow = fecha.getUTCDay();
    if ((dow === 0 || dow === 6) && azar() < 0.3) continue; // fines de semana, menos
    const hora = elegir(horas);
    const t = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(), hora + 5, Math.floor(azar() * 60), Math.floor(azar() * 60)));
    const v = Math.floor(azar() ** 1.6 * visitantes);
    const d = elegir(disp);
    const c = elegir(ciudades);
    const completa = azar() < 0.34;
    const rebote = !completa && azar() < 0.2;
    const scroll = completa ? 85 + Math.floor(azar() * 16) : rebote ? Math.floor(azar() * 20) : 20 + Math.floor(azar() * 65);
    const seg = completa ? 45 + Math.floor(azar() * 220) : rebote ? Math.floor(azar() * 9) : 10 + Math.floor(azar() * 90);
    const recurrente = vistos.has(v);
    vistos.add(v);
    const q = (x: string | null) => (x === null ? "null" : `'${x.replace(/'/g, "''")}'`);
    filas.push(`('${uuid(v + 1)}', '${elegir(pesoNota)}', '${t.toISOString()}', '${t.toISOString()}', '${d.device}', ${q(d.browser)}, ${q(d.os)}, 'CO', ${q(c.region)}, ${q(c.city)}, ${q(elegir(fuentes))}, ${recurrente}, ${Math.min(100, scroll)}, ${seg})`);
    n++;
  }
  for (let i = 0; i < filas.length; i += 500)
    await db.exec(`insert into reader_sessions (visitor_id, article_id, created_at, updated_at, device, browser, os, country, region, city, source, "returning", max_scroll, seconds) values ${filas.slice(i, i + 500).join(",")}`);
  console.log(`lecturas de prueba sembradas: ${n}`);
  // Suscriptores de prueba: altas repartidas en 90 días, con ciudad, edad y proveedor de correo variados.
  const proveedores: [string, number][] = [["gmail.com", 58], ["hotmail.com", 18], ["outlook.com", 8], ["yahoo.com", 6], ["fedegan.org.co", 4], ["universidad.edu.co", 6]];
  const lugares: [{ c: string; lat: number; lon: number }, number][] = [[{ c: "Bogotá", lat: 4.711, lon: -74.072 }, 40], [{ c: "Medellín", lat: 6.244, lon: -75.581 }, 18], [{ c: "Montería", lat: 8.748, lon: -75.881 }, 10], [{ c: "Villavicencio", lat: 4.142, lon: -73.626 }, 9], [{ c: "Cali", lat: 3.451, lon: -76.532 }, 8], [{ c: "Yopal", lat: 5.337, lon: -72.395 }, 5], [{ c: "Valledupar", lat: 10.463, lon: -73.253 }, 5], [{ c: "Bucaramanga", lat: 7.119, lon: -73.122 }, 5]];
  const subs: string[] = [];
  for (let i = 0; i < 400; i++) {
    const dias = Math.floor(azar() ** 1.3 * 90);
    const alta = new Date(Date.now() - dias * 86_400_000 - Math.floor(azar() * 80_000_000));
    const lugar = elegir(lugares);
    const edad = 18 + Math.floor(azar() ** 0.9 * 50);
    const nac = new Date(Date.now() - edad * 365.25 * 86_400_000).toISOString().slice(0, 10);
    const confirmado = azar() < 0.86;
    const baja = confirmado && azar() < 0.06;
    subs.push(`('prueba-seed-${i}@${elegir(proveedores)}', ${confirmado}, '${alta.toISOString()}', ${baja ? `'${new Date(alta.getTime() + 20 * 86_400_000).toISOString()}'` : "null"}, ${azar() < 0.7 ? `'${nac}'` : "null"}, '${lugar.c}', 'CO', ${lugar.lat}, ${lugar.lon}, '${elegir<string>([["ip", 80], ["gps", 14], ["red", 6]])}')`);
  }
  await db.exec(`insert into newsletter_subscribers (email, confirmed, created_at, unsubscribed_at, birth_date, signup_city, signup_country, signup_lat, signup_lon, signup_geo_source) values ${subs.join(",")} on conflict do nothing`);
  console.log(`suscriptores de prueba sembrados: ${subs.length}`);
  await db.close();
}
void main();
