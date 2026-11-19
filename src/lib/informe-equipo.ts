import "server-only";
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db";
import { ASIGNADAS_KEY, type Asignacion } from "@/lib/notas-asignadas";
import { papelEnNota } from "@/lib/actividad-reglas";

const filas = <T,>(r: unknown) => rowsOf<Record<string, unknown>>(r) as unknown as T[];
const TZ = "America/Bogota";

export type PapelNota = "autor" | "intervino" | "reviso" | "sin-abrir" | "participo";
export type NotaPersona = { id: string; titulo: string; estado: string; papel: PapelNota; palabras: number; comentarios: number; publico: boolean; envio: boolean; ultima: string };
export type PersonaInforme = {
  id: string; nombre: string; rol: string;
  creadas: number; recibidas: number; intervino: number; reviso: number; sinAbrir: number; palabras: number;
  publicadas: number; programadas: number; enviadas: number; devueltas: number; comentarios: number;
  notas: NotaPersona[];
};

/**
 * Lo que hizo cada persona del equipo en las notas entre `desde` y `hasta` (días de Colombia): cuántas escribió, cuántas le enviaron y, de esas,
 * en cuántas intervino (cambió el texto) y cuántas solo revisó; cuántas publicó, programó, envió o devolvió y cuántos comentarios dejó.
 * Las ediciones se miden desde que existe el registro de actividad; las notas escritas, los envíos vigentes y los comentarios, desde siempre.
 */
export async function informeEquipo(desde: string, hasta: string): Promise<PersonaInforme[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return [];
  const rango = (col: "created_at") => sql`${sql.raw(col)} >= (${desde}::date)::timestamp at time zone ${TZ} and ${sql.raw(col)} < (${hasta}::date + 1)::timestamp at time zone ${TZ}`;
  const [actividad, creadas, comentarios, asignadas, personas] = await Promise.all([
    db.execute(sql`select article_id::text a, user_id::text u, tipo, sum(veces)::int veces, sum(palabras)::int palabras, max(ultima)::text ultima
      from article_activity where dia between ${desde}::date and ${hasta}::date group by 1, 2, 3`).then((r) => filas<{ a: string; u: string; tipo: string; veces: number; palabras: number; ultima: string }>(r)).catch(() => []),
    db.execute(sql`select id::text a, created_by::text u, created_at::text ultima from articles where created_by is not null and ${rango("created_at")}`).then((r) => filas<{ a: string; u: string; ultima: string }>(r)),
    db.execute(sql`select article_id::text a, author_id::text u, count(*)::int n, max(created_at)::text ultima from article_comments where author_id is not null and ${rango("created_at")} group by 1, 2`).then((r) => filas<{ a: string; u: string; n: number; ultima: string }>(r)),
    db.execute(sql`select value from site_settings where key = ${ASIGNADAS_KEY}`).then((r) => (filas<{ value: Asignacion[] }>(r)[0]?.value ?? []) as Asignacion[]),
    db.execute(sql`select id::text id, name nombre, role rol from users`).then((r) => filas<{ id: string; nombre: string; rol: string }>(r)),
  ]);

  // Por persona y nota, todo lo que pasó.
  type Acum = { recibio: boolean; reviso: boolean; palabras: number; creo: boolean; publico: boolean; programo: boolean; envio: boolean; devolvio: boolean; comentarios: number; ultima: string };
  const mapa = new Map<string, Map<string, Acum>>();
  const de = (u: string, a: string) => {
    let m = mapa.get(u);
    if (!m) mapa.set(u, (m = new Map()));
    let x = m.get(a);
    if (!x) m.set(a, (x = { recibio: false, reviso: false, palabras: 0, creo: false, publico: false, programo: false, envio: false, devolvio: false, comentarios: 0, ultima: "" }));
    return x;
  };
  const tarde = (x: Acum, t: string) => { if (t > x.ultima) x.ultima = t; };
  for (const f of actividad) {
    const x = de(f.u, f.a);
    tarde(x, f.ultima);
    if (f.tipo === "edito") x.palabras += f.palabras;
    else if (f.tipo === "recibio") x.recibio = true;
    else if (f.tipo === "reviso") x.reviso = true;
    else if (f.tipo === "creo") x.creo = true;
    else if (f.tipo === "publico") x.publico = true;
    else if (f.tipo === "programo") x.programo = true;
    else if (f.tipo === "envio") x.envio = true;
    else if (f.tipo === "devolvio") x.devolvio = true;
  }
  for (const f of creadas) { const x = de(f.u, f.a); x.creo = true; tarde(x, f.ultima); }
  for (const f of comentarios) { const x = de(f.u, f.a); x.comentarios += f.n; tarde(x, f.ultima); }
  // Envíos vigentes dentro del periodo (sirven también para lo enviado antes de que existiera el registro).
  for (const s of Array.isArray(asignadas) ? asignadas : []) {
    const dia = new Date(s.fecha).toLocaleDateString("en-CA", { timeZone: TZ });
    if (dia < desde || dia > hasta) continue;
    const x = de(s.editorId, s.articleId);
    x.recibio = true;
    if (s.abiertaAt) x.reviso = true;
    tarde(x, s.fecha);
    if (s.porId && s.porId !== s.editorId) { const y = de(s.porId, s.articleId); y.envio = true; tarde(y, s.fecha); }
  }

  const ids = [...new Set([...mapa.values()].flatMap((m) => [...m.keys()]))];
  const notas = ids.length
    ? new Map(filas<{ id: string; titulo: string; estado: string }>(await db.execute(sql`select id::text id, title titulo, status estado from articles where id in (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`)).map((n) => [n.id, n]))
    : new Map<string, { id: string; titulo: string; estado: string }>();
  const persona = new Map(personas.map((p) => [p.id, p]));

  const salida: PersonaInforme[] = [];
  for (const [u, m] of mapa) {
    const p = persona.get(u);
    if (!p) continue;
    const r: PersonaInforme = { id: u, nombre: p.nombre, rol: p.rol, creadas: 0, recibidas: 0, intervino: 0, reviso: 0, sinAbrir: 0, palabras: 0, publicadas: 0, programadas: 0, enviadas: 0, devueltas: 0, comentarios: 0, notas: [] };
    for (const [a, x] of m) {
      const n = notas.get(a);
      if (!n) continue;
      const enviada = papelEnNota(x);
      const papel: PapelNota = x.creo ? "autor" : enviada ?? (x.palabras > 0 ? "intervino" : "participo");
      if (x.creo) r.creadas += 1;
      if (enviada) { r.recibidas += 1; if (enviada === "intervino") r.intervino += 1; else if (enviada === "reviso") r.reviso += 1; else r.sinAbrir += 1; }
      r.palabras += x.palabras;
      if (x.publico) r.publicadas += 1;
      if (x.programo) r.programadas += 1;
      if (x.envio) r.enviadas += 1;
      if (x.devolvio) r.devueltas += 1;
      r.comentarios += x.comentarios;
      r.notas.push({ id: a, titulo: n.titulo, estado: n.estado, papel, palabras: x.palabras, comentarios: x.comentarios, publico: x.publico, envio: x.envio, ultima: x.ultima });
    }
    r.notas.sort((a, b) => b.ultima.localeCompare(a.ultima));
    if (r.notas.length) salida.push(r);
  }
  return salida.sort((a, b) => b.notas.length - a.notas.length || a.nombre.localeCompare(b.nombre, "es"));
}
