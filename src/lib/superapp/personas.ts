import "server-only";
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db";
import { newsletterSubscribers, superappPersonas, superappVisitantes } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import type { ContactoSuperApp, IdentidadSuperApp } from "./contrato";

/** Etiqueta de origen de las lecturas hechas con una sesión de la SuperApp (la misma que muestra el filtro «Origen»). */
export const FUENTE_SUPERAPP = "SuperApp FEDEGÁN";

/**
 * Registra (o actualiza) a la persona que acaba de entrar desde la SuperApp: correo y documento cifrados, el final del documento a la vista y,
 * si su correo coincide con un suscriptor del boletín, el vínculo con esa suscripción. Si falla, la entrada sigue: no es parte del acceso.
 */
export async function registrarPersona(i: IdentidadSuperApp, c: ContactoSuperApp | null): Promise<void> {
  try {
    let subscriberId: string | null = null;
    if (c?.email) {
      const [s] = await db
        .select({ id: newsletterSubscribers.id })
        .from(newsletterSubscribers)
        .where(sql`lower(${newsletterSubscribers.email}) = ${c.email} and ${newsletterSubscribers.unsubscribedAt} is null`)
        .limit(1);
      subscriberId = s?.id ?? null;
    }
    const datos = {
      emailCifrado: c?.email ? encryptSecret(c.email) : null,
      documentoTipo: c?.documentoTipo ?? null,
      documentoCifrado: c?.documentoNumero ? encryptSecret(c.documentoNumero) : null,
      documentoFinal: c?.documentoNumero ? c.documentoNumero.slice(-4) : null,
      assuranceLevel: i.assuranceLevel,
      subscriberId,
      ultimaEntrada: new Date(),
    };
    await db
      .insert(superappPersonas)
      .values({ audience: i.audience, subject: i.subject, ...datos })
      .onConflictDoUpdate({ target: [superappPersonas.audience, superappPersonas.subject], set: datos });
  } catch (err) {
    console.warn("[superapp] no se pudo registrar a la persona", err instanceof Error ? err.message : "");
  }
}

/** Une el navegador de la medición con la persona de la SuperApp (una vez por pareja). */
export async function vincularVisitante(audience: string, subject: string, visitorId: string): Promise<void> {
  await db.insert(superappVisitantes).values({ audience, subject, visitorId }).onConflictDoNothing();
}

// --- Consultas del panel (pestaña «SuperApp» del análisis) ---

const filas = <T,>(r: unknown) => rowsOf<Record<string, unknown>>(r) as unknown as T[];
const TZ = "America/Bogota";

export type ResumenSuperApp = { personas: number; nuevas: number; entradas: number; suscritas: number; lectores: number; lecturas: number; segundos: number };
export type PersonaSuperApp = {
  subject: string;
  correo: string | null;
  documento: string | null;
  suscrita: boolean;
  primera: string;
  ultima: string;
  entradas: number;
  notas: number;
  segundos: number;
  nivel: number;
};
export type EntradaDia = { dia: string; entradas: number; personas: number };

type Periodo = { desde: string; hasta: string };
// Rango del periodo en hora de Colombia (fechas YYYY-MM-DD, ambas incluidas).
const enPeriodo = (col: ReturnType<typeof sql.raw>, p: Periodo) =>
  sql`(${col} at time zone ${TZ})::date between ${p.desde}::date and ${p.hasta}::date`;

/** Cifras del periodo: personas que entraron, cuántas por primera vez, entradas, cuántas son suscriptoras y lo que leyeron. */
export async function resumenSuperApp(p: Periodo): Promise<ResumenSuperApp> {
  const [r] = filas<ResumenSuperApp>(
    await db.execute(sql`with ent as (select audience, subject from superapp_sesiones where ${enPeriodo(sql.raw("created_at"), p)}),
      lect as (select s.visitor_id, s.seconds from reader_sessions s join superapp_visitantes v on v.visitor_id = s.visitor_id and s.created_at >= v.linked_at
        where ${enPeriodo(sql.raw("s.created_at"), p)})
      select (select count(distinct (audience, subject)) from ent)::int personas,
        (select count(*) from superapp_personas where ${enPeriodo(sql.raw("primera_entrada"), p)})::int nuevas,
        (select count(*) from ent)::int entradas,
        (select count(*) from superapp_personas sp where sp.subscriber_id is not null and (sp.audience, sp.subject) in (select audience, subject from ent))::int suscritas,
        (select count(distinct visitor_id) from lect)::int lectores,
        (select count(*) from lect)::int lecturas,
        (select coalesce(sum(seconds), 0) from lect)::int segundos`),
  );
  return r ?? { personas: 0, nuevas: 0, entradas: 0, suscritas: 0, lectores: 0, lecturas: 0, segundos: 0 };
}

/** Entradas y personas por día del periodo, para la gráfica. */
export async function entradasPorDia(p: Periodo): Promise<EntradaDia[]> {
  return filas<EntradaDia>(
    await db.execute(sql`select to_char(d, 'YYYY-MM-DD') dia, coalesce(e.entradas, 0)::int entradas, coalesce(e.personas, 0)::int personas
      from generate_series(${p.desde}::date, ${p.hasta}::date, interval '1 day') d
      left join (select (created_at at time zone ${TZ})::date dia, count(*) entradas, count(distinct (audience, subject)) personas from superapp_sesiones
        where ${enPeriodo(sql.raw("created_at"), p)} group by 1) e on e.dia = d::date
      order by d`),
  );
}

/**
 * Una fila por persona que entró en el periodo (las más recientes primero). Con `verDatos` se descifra el correo y se muestra el documento
 * como «CC ••••0001»; sin ese permiso solo se ve el código de la persona.
 */
export async function personasSuperApp(p: Periodo, verDatos: boolean): Promise<PersonaSuperApp[]> {
  const rows = filas<PersonaSuperApp & { emailCifrado: string | null; documentoTipo: string | null; documentoFinal: string | null }>(
    await db.execute(sql`with ent as (select audience, subject, count(*)::int entradas from superapp_sesiones where ${enPeriodo(sql.raw("created_at"), p)} group by 1, 2),
      lect as (select v.audience, v.subject, count(*)::int notas, coalesce(sum(s.seconds), 0)::int segundos from superapp_visitantes v
        join reader_sessions s on s.visitor_id = v.visitor_id and s.created_at >= v.linked_at where ${enPeriodo(sql.raw("s.created_at"), p)} group by 1, 2)
      select sp.subject, sp.email_cifrado "emailCifrado", sp.documento_tipo "documentoTipo", sp.documento_final "documentoFinal",
        sp.subscriber_id is not null suscrita, sp.assurance_level nivel,
        to_char(sp.primera_entrada at time zone ${TZ}, 'YYYY-MM-DD HH24:MI') primera, to_char(sp.ultima_entrada at time zone ${TZ}, 'YYYY-MM-DD HH24:MI') ultima,
        ent.entradas, coalesce(lect.notas, 0) notas, coalesce(lect.segundos, 0) segundos
      from superapp_personas sp join ent on ent.audience = sp.audience and ent.subject = sp.subject
      left join lect on lect.audience = sp.audience and lect.subject = sp.subject
      order by sp.ultima_entrada desc limit 300`),
  );
  return rows.map(({ emailCifrado, documentoTipo, documentoFinal, ...r }) => ({
    ...r,
    correo: verDatos && emailCifrado ? decryptSecret(emailCifrado) : null,
    documento: verDatos && documentoFinal ? `${documentoTipo ?? ""} ••••${documentoFinal}`.trim() : null,
  }));
}
