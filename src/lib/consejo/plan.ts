/**
 * Consejo de redacción semanal: tipos y lógica PURA (sin servidor: la usa también la pantalla del panel).
 *
 * Un consejo de redacción real planea la semana: qué cubre cada sección, cuántas piezas por día, en qué horas sale cada una, quién la
 * aprueba y qué prioridad tiene. Aquí el plan es una PARRILLA (días × horas × secciones) que se construye con código —así las fechas y
 * las cuotas nunca las inventa el modelo— y la IA solo propone los temas, enfoques y encargos de cada casilla.
 */

/** Cómo sale una pieza: con aprobación previa de un editor, o sola a su hora (solo si quien activó el plan puede publicar). */
export type Aprobacion = "manual" | "auto";

export type EstadoPlan = "borrador" | "activo" | "cerrado";
export type EstadoCasilla = "planificada" | "redactando" | "revision" | "programada" | "publicada" | "fallida" | "omitida";

export const ESTADOS_CASILLA: Record<EstadoCasilla, string> = {
  planificada: "Planificada",
  redactando: "Redactando",
  revision: "Esperando aprobación",
  programada: "Programada",
  publicada: "Publicada",
  fallida: "Falló",
  omitida: "Omitida",
};

/** Cuota de una sección: cuántas notas por día y con qué aprobación salen. */
export type CuotaSeccion = { seccion: string; porDia: number; aprobacion?: Aprobacion };

/** Configuración del consejo (se guarda en `editorial_plans.config`). */
export type ConfigConsejo = {
  /** Días de la semana que se publican (ISO: 1 = lunes … 7 = domingo). */
  dias: number[];
  /** Horas de publicación disponibles, «HH:MM» en hora de Colombia, de la más temprana a la más tarde. */
  horas: string[];
  cuotas: CuotaSeccion[];
  /** Aprobación por defecto de las casillas nuevas. */
  aprobacion: Aprobacion;
  /** Con cuántas horas de antelación se redacta cada borrador (para que el editor alcance a revisarlo). */
  antelacionHoras: number;
};

export const CONFIG_BASE: ConfigConsejo = {
  dias: [1, 2, 3, 4, 5],
  horas: ["07:00", "10:00", "13:00", "16:00", "19:00"],
  cuotas: [],
  aprobacion: "manual",
  antelacionHoras: 4,
};

/** Un tema que el consejo quiere cubrir (lo escribe una persona o lo propone la IA). */
export type TemaConsejo = { id: string; texto: string; seccion?: string; prioridad: 1 | 2 | 3; origen: "manual" | "ia"; angulo?: string };

/** Una casilla de la parrilla: una pieza con su día, hora y sección. */
export type CasillaBase = { publicaEn: Date; seccion: string; aprobacion: Aprobacion; prioridad: 1 | 2 | 3 };

export const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;
const BOGOTA = "-05:00"; // Colombia no tiene horario de verano.

/** Lunes de la semana de una fecha «AAAA-MM-DD» (misma fecha si ya es lunes). */
export function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00${BOGOTA}`);
  const dia = (d.getUTCDay() + 6) % 7; // lunes = 0
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
}

/** Fecha «AAAA-MM-DD» sumando días. */
export function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00${BOGOTA}`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Instante exacto de «AAAA-MM-DD» + «HH:MM» en hora de Colombia. */
export const instante = (fecha: string, hora: string): Date => new Date(`${fecha}T${hora}:00${BOGOTA}`);

/** Valida y completa una configuración recibida del navegador o de la base. */
export function sanearConfig(input: unknown): ConfigConsejo {
  const c = (input && typeof input === "object" ? input : {}) as Partial<ConfigConsejo>;
  const dias = [...new Set((Array.isArray(c.dias) ? c.dias : CONFIG_BASE.dias).filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort();
  const horas = [...new Set((Array.isArray(c.horas) ? c.horas : CONFIG_BASE.horas).filter((h): h is string => typeof h === "string" && HORA_VALIDA.test(h)))].sort();
  const cuotas = (Array.isArray(c.cuotas) ? c.cuotas : [])
    .filter((q): q is CuotaSeccion => !!q && typeof q.seccion === "string" && /^[\w-]{1,80}$/.test(q.seccion))
    .map((q) => ({ seccion: q.seccion, porDia: Math.min(6, Math.max(0, Math.round(Number(q.porDia) || 0))), ...(q.aprobacion === "auto" || q.aprobacion === "manual" ? { aprobacion: q.aprobacion } : {}) }))
    .filter((q, i, a) => q.porDia > 0 && a.findIndex((x) => x.seccion === q.seccion) === i);
  return {
    dias: dias.length ? dias : CONFIG_BASE.dias,
    horas: horas.length ? horas : CONFIG_BASE.horas,
    cuotas,
    aprobacion: c.aprobacion === "auto" ? "auto" : "manual",
    antelacionHoras: Math.min(48, Math.max(1, Math.round(Number(c.antelacionHoras) || CONFIG_BASE.antelacionHoras))),
  };
}

/**
 * Construye la parrilla de una semana: para cada día elegido, reparte las notas de cada sección entre las horas disponibles de forma
 * pareja (con 2 notas y 5 horas, la 1.ª sale temprano y la 2.ª a media tarde) y desfasa las secciones para no apilar todas a la misma hora.
 * Las casillas que ya pasaron no se crean. Devuelve las casillas ordenadas por fecha y hora.
 */
export function construirParrilla(lunes: string, cfg: ConfigConsejo, ahora: Date = new Date()): CasillaBase[] {
  const out: CasillaBase[] = [];
  const horas = cfg.horas;
  if (!horas.length) return out;
  for (const dia of cfg.dias) {
    const fecha = sumarDias(lunes, dia - 1);
    // Cuántas casillas se han puesto ya en cada hora ese día: así las secciones se reparten por todas las horas.
    const usadas = new Map<string, number>();
    cfg.cuotas.forEach((q, qi) => {
      for (let k = 0; k < q.porDia; k++) {
        // Posición ideal repartida en el día + un desfase por sección; si la hora está muy cargada se busca la más libre cercana.
        const ideal = Math.floor(((k + 0.5) * horas.length) / q.porDia + qi) % horas.length;
        const candidatas = horas.map((h, i) => ({ h, carga: usadas.get(h) ?? 0, dist: Math.min(Math.abs(i - ideal), horas.length - Math.abs(i - ideal)) }));
        candidatas.sort((a, b) => a.carga - b.carga || a.dist - b.dist);
        const hora = candidatas[0].h;
        usadas.set(hora, (usadas.get(hora) ?? 0) + 1);
        const publicaEn = instante(fecha, hora);
        if (publicaEn.getTime() <= ahora.getTime()) continue;
        out.push({ publicaEn, seccion: q.seccion, aprobacion: q.aprobacion ?? cfg.aprobacion, prioridad: 2 });
      }
    });
  }
  return out.sort((a, b) => a.publicaEn.getTime() - b.publicaEn.getTime() || a.seccion.localeCompare(b.seccion));
}

/** Resumen de cuántas notas lleva una configuración en la semana (para mostrarlo antes de armar la pauta). */
export const notasPorSemana = (cfg: ConfigConsejo) => cfg.dias.length * cfg.cuotas.reduce((s, q) => s + q.porDia, 0);

/** ¿Ya toca redactar esta casilla? (faltan `antelacionHoras` o menos para su hora). */
export const tocaRedactar = (publicaEn: Date, cfg: Pick<ConfigConsejo, "antelacionHoras">, ahora: Date = new Date()) =>
  publicaEn.getTime() - ahora.getTime() <= cfg.antelacionHoras * 3600_000;
