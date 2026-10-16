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
  /** Añade al final de cada nota redactada por la IA el aviso de que se elaboró con su asistencia (transparencia con el lector). Por defecto sí. */
  divulgarIA?: boolean;
  /** Escritor cuyo estilo imita la IA (persona de la redacción o escritor externo; ver src/lib/ai/estilo.ts). Vacío = el de quien activa el plan. */
  escritorId?: string;
  /** Respuestas del consejo a las preguntas de cada sección (temas de interés, extensión, tono…), por slug de sección. */
  briefs?: Record<string, BriefSeccion>;
};

export const CONFIG_BASE: ConfigConsejo = {
  dias: [1, 2, 3, 4, 5],
  horas: ["07:00", "10:00", "13:00", "16:00", "19:00"],
  cuotas: [],
  aprobacion: "manual",
  antelacionHoras: 4,
  divulgarIA: true,
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
    divulgarIA: c.divulgarIA !== false,
    ...(typeof c.escritorId === "string" && /^[0-9a-f-]{36}$/i.test(c.escritorId) ? { escritorId: c.escritorId } : {}),
    ...(briefsSaneados(c.briefs) ? { briefs: briefsSaneados(c.briefs) } : {}),
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

/* -------------------------------------------------------------------------------------------------------------------------------
 * Ficha de pauta: lo que un consejo de redacción real deja definido ANTES de encargar una nota. Es el insumo del editor de IA: sin foco,
 * sin audiencia y sin fuentes la IA no debe redactar (inventaría). Ver docs/consejo-de-redaccion.md para el porqué de cada campo.
 * ------------------------------------------------------------------------------------------------------------------------------- */

export type Genero = "noticia" | "explicativo" | "analisis" | "datos" | "cronica" | "entrevista";
export const GENEROS: Record<Genero, string> = { noticia: "Noticia", explicativo: "Explicativo", analisis: "Análisis", datos: "Datos y cifras", cronica: "Crónica", entrevista: "Entrevista" };
export type Vigencia = "hoy" | "semana" | "atemporal";
export const VIGENCIAS: Record<Vigencia, string> = { hoy: "Urgente (se pierde si no sale hoy)", semana: "Vigente toda la semana", atemporal: "Atemporal (puede moverse)" };

/** Una fuente prevista: una voz (persona o entidad) o un documento/dato oficial, con su enlace si ya se conoce. */
export type FuentePrevista = { nombre: string; tipo: "voz" | "documento"; url?: string };

export type FichaPauta = {
  /** 1 · Foco: la nota en una frase («alguien hace algo porque…»). */
  foco?: string;
  /** 2 · ¿Por qué ahora? El gancho de actualidad. */
  porQueAhora?: string;
  /** 3 · ¿A quién le importa y qué cambia para él? */
  audiencia?: string;
  /** 4 · ¿Qué aporta que no se haya publicado ya? */
  novedad?: string;
  /** 5 · Fuentes previstas: voces y documentos oficiales. */
  fuentes?: FuentePrevista[];
  /** 6 · Datos y cifras que hay que confirmar antes de afirmarlos. */
  datosAConfirmar?: string[];
  /** 7 · Preguntas que la nota debe responder (lo que se sabe) y las que quedan abiertas (lo que NO se sabe: no se escribe como si se supiera). */
  preguntas?: string[];
  abiertas?: string[];
  /** 8 · Género y extensión. */
  genero?: Genero;
  palabras?: number;
  /** 9 · Riesgos y sensibilidad: réplica, presunción de inocencia, menores, salud animal/pública, conflicto de interés. */
  riesgos?: string[];
  /** 10 · Imagen o gráfica sugerida. */
  visual?: string;
  /** 11 · Palabra clave de enfoque (lo que el productor escribiría en el buscador). */
  palabraClave?: string;
  /** 12 · Cuánto dura vigente la nota. */
  vigencia?: Vigencia;
  /** 13 · Lo que NO debe hacer la nota. */
  evitar?: string[];
  /** 14 · Quién la escribe: el escritor cuyo estilo imita la IA en ESTA pieza (si falta, el del consejo). */
  escritorId?: string;
};

export const FICHA_VACIA: FichaPauta = {};

/** Qué pide cada pregunta de la ficha: etiqueta, ayuda y si es obligatoria para poder redactar. */
export const PREGUNTAS_FICHA: { clave: keyof FichaPauta; etiqueta: string; ayuda: string; obligatoria: boolean }[] = [
  { clave: "foco", etiqueta: "¿De qué trata, en una frase?", ayuda: "«Alguien hace algo porque…». Si no cabe en una frase, la nota no está enfocada.", obligatoria: true },
  { clave: "porQueAhora", etiqueta: "¿Por qué ahora?", ayuda: "El hecho, la fecha o la decisión que hace que valga la pena publicarla esta semana.", obligatoria: true },
  { clave: "audiencia", etiqueta: "¿A quién le importa y qué cambia para él?", ayuda: "El productor, el comercializador, el gremio… y la consecuencia concreta.", obligatoria: true },
  { clave: "novedad", etiqueta: "¿Qué aporta que no se haya publicado ya?", ayuda: "Un dato, una voz o un ángulo nuevos frente a lo que ya salió en el sitio y en otros medios.", obligatoria: false },
  { clave: "fuentes", etiqueta: "Fuentes previstas", ayuda: "Quién debe hablar (con su cargo) y qué documentos u oficiales respaldan la nota. Mínimo una.", obligatoria: true },
  { clave: "datosAConfirmar", etiqueta: "Datos que hay que confirmar", ayuda: "Cifras, fechas y cargos que no se afirman hasta verlos en la fuente.", obligatoria: false },
  { clave: "preguntas", etiqueta: "Preguntas que la nota debe responder", ayuda: "Qué, quién, cuándo, dónde, por qué y cómo. Mínimo dos.", obligatoria: true },
  { clave: "abiertas", etiqueta: "Lo que aún no se sabe", ayuda: "Se dice que no se sabe; nunca se escribe como si se supiera.", obligatoria: false },
  { clave: "genero", etiqueta: "Género y extensión", ayuda: "Noticia, explicativo, análisis, datos, crónica o entrevista, y cuántas palabras.", obligatoria: false },
  { clave: "riesgos", etiqueta: "Riesgos y sensibilidad", ayuda: "Derecho de réplica, presunción de inocencia, menores, alertas sanitarias, conflicto de interés.", obligatoria: false },
  { clave: "visual", etiqueta: "Imagen o gráfica", ayuda: "Qué se muestra y de dónde saldrán los datos.", obligatoria: false },
  { clave: "palabraClave", etiqueta: "Palabra clave de enfoque", ayuda: "Lo que un ganadero escribiría en el buscador.", obligatoria: false },
  { clave: "vigencia", etiqueta: "Vigencia", ayuda: "Si se pierde hoy, dura la semana o se puede mover.", obligatoria: false },
  { clave: "evitar", etiqueta: "Lo que NO debe decir", ayuda: "Afirmaciones sin respaldo, enfoques ya agotados, términos sensibles.", obligatoria: false },
];

const lleno = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim().length >= 8 : typeof v === "number" ? v > 0 : !!v);

/** ¿Está lista la ficha para redactar? Devuelve el avance (0-100) y qué falta. Lo obligatorio frena la redacción; lo demás solo suma. */
export function evaluarFicha(f: FichaPauta | null | undefined): { lista: boolean; avance: number; faltanObligatorias: string[]; faltanOpcionales: string[] } {
  const ficha = f ?? {};
  const faltanObligatorias: string[] = [];
  const faltanOpcionales: string[] = [];
  let ok = 0;
  for (const q of PREGUNTAS_FICHA) {
    const v = ficha[q.clave];
    // «preguntas» pide al menos dos; «fuentes» al menos una con nombre.
    const bien = q.clave === "preguntas" ? Array.isArray(v) && v.filter((x) => String(x).trim().length >= 6).length >= 2 : lleno(v);
    if (bien) ok++;
    else (q.obligatoria ? faltanObligatorias : faltanOpcionales).push(q.etiqueta);
  }
  return { lista: faltanObligatorias.length === 0, avance: Math.round((ok / PREGUNTAS_FICHA.length) * 100), faltanObligatorias, faltanOpcionales };
}

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : undefined) || undefined;
const lista = (v: unknown, max: number, n: number) => {
  const xs = (Array.isArray(v) ? v : []).map((x) => texto(x, max)).filter((x): x is string => !!x).slice(0, n);
  return xs.length ? xs : undefined;
};

/** Valida lo que llegue del navegador o de la IA. */
export function sanearFicha(input: unknown): FichaPauta {
  const f = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const fuentes = (Array.isArray(f.fuentes) ? f.fuentes : [])
    .map((x) => {
      const r = (x ?? {}) as Record<string, unknown>;
      const nombre = texto(r.nombre, 160);
      const url = typeof r.url === "string" && /^https?:\/\/[^\s<>"']{4,300}$/.test(r.url.trim()) ? r.url.trim() : undefined;
      return nombre ? { nombre, tipo: r.tipo === "documento" ? ("documento" as const) : ("voz" as const), ...(url ? { url } : {}) } : null;
    })
    .filter((x): x is FuentePrevista => !!x)
    .slice(0, 10);
  const out: FichaPauta = {
    foco: texto(f.foco, 300), porQueAhora: texto(f.porQueAhora, 300), audiencia: texto(f.audiencia, 300), novedad: texto(f.novedad, 300),
    fuentes: fuentes.length ? fuentes : undefined, datosAConfirmar: lista(f.datosAConfirmar, 200, 10), preguntas: lista(f.preguntas, 200, 10), abiertas: lista(f.abiertas, 200, 10),
    genero: (Object.keys(GENEROS) as Genero[]).find((g) => g === f.genero), palabras: typeof f.palabras === "number" && f.palabras >= 150 && f.palabras <= 1500 ? Math.round(f.palabras) : undefined,
    riesgos: lista(f.riesgos, 200, 8), visual: texto(f.visual, 250), palabraClave: texto(f.palabraClave, 80),
    vigencia: (Object.keys(VIGENCIAS) as Vigencia[]).find((v) => v === f.vigencia), evitar: lista(f.evitar, 200, 8),
    escritorId: typeof f.escritorId === "string" && /^[0-9a-f-]{36}$/i.test(f.escritorId) ? f.escritorId : undefined,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as FichaPauta;
}

/** La ficha convertida en el bloque de texto que se le entrega al editor de IA como encargo estructurado. */
export function fichaParaPrompt(f: FichaPauta): string {
  const l = (t: string, xs?: string[]) => (xs?.length ? `${t}:\n${xs.map((x) => `- ${x}`).join("\n")}` : "");
  return [
    "FICHA DE PAUTA (la definió el consejo de redacción; es el encargo: síguela):",
    f.foco && `FOCO: ${f.foco}`,
    f.porQueAhora && `POR QUÉ AHORA: ${f.porQueAhora}`,
    f.audiencia && `A QUIÉN LE IMPORTA: ${f.audiencia}`,
    f.novedad && `QUÉ APORTA DE NUEVO: ${f.novedad}`,
    f.genero && `GÉNERO: ${GENEROS[f.genero]}${f.palabras ? `, de unas ${f.palabras} palabras` : ""}.`,
    f.fuentes?.length && `FUENTES PREVISTAS (atribuye con ellas; no inventes otras):\n${f.fuentes.map((x) => `- ${x.nombre} (${x.tipo === "voz" ? "voz" : "documento/dato oficial"})${x.url ? ` ${x.url}` : ""}`).join("\n")}`,
    l("DATOS A CONFIRMAR (solo se afirman si constan en el material o el dossier)", f.datosAConfirmar),
    l("PREGUNTAS QUE LA NOTA DEBE RESPONDER", f.preguntas),
    l("LO QUE AÚN NO SE SABE (di que no se sabe; no lo escribas como hecho)", f.abiertas),
    l("RIESGOS Y SENSIBILIDAD (trátalos con cuidado: réplica, presunción de inocencia, menores, alertas sanitarias)", f.riesgos),
    f.palabraClave && `PALABRA CLAVE DE ENFOQUE: ${f.palabraClave} (en el título y el primer párrafo, con naturalidad).`,
    f.visual && `IMAGEN/GRÁFICA SUGERIDA: ${f.visual}`,
    l("LO QUE NO DEBE DECIR", f.evitar),
  ].filter(Boolean).join("\n");
}

/* -------------------------------------------------------------------------------------------------------------------------------
 * Preguntas del editor jefe a cada sección: lo que el consejo contesta ANTES de pedirle temas a la IA. Sirven para proponer mejores temas,
 * armar la pauta y redactar (extensión, tono, qué evitar, fuentes preferidas…).
 * ------------------------------------------------------------------------------------------------------------------------------- */

export const AUDIENCIAS = ["Productores ganaderos", "Gremios y asociaciones", "Comercializadores e industria", "Público general", "Mixta"] as const;
export const ALCANCES = ["Colombia", "Una región o departamento", "Internacional", "Colombia e internacional"] as const;
export const TONOS = ["Informativo y neutral", "Cercano y práctico para el productor", "Técnico y de datos", "Analítico y crítico"] as const;
export const PALABRAS_OPCIONES = [300, 450, 600, 800, 1000] as const;

export type BriefSeccion = {
  /** ¿Qué temas o asuntos te interesan esta semana? */
  temas?: string;
  audiencia?: (typeof AUDIENCIAS)[number];
  /** ¿Qué géneros? (noticia, explicativo, análisis…) */
  generos?: Genero[];
  /** ¿Cuántas palabras por nota? */
  palabras?: number;
  alcance?: (typeof ALCANCES)[number];
  /** Regiones, departamentos o países de interés. */
  lugares?: string;
  tono?: (typeof TONOS)[number];
  /** ¿Qué debe evitar? */
  evitar?: string;
  /** ¿Hay eventos, ferias, decisiones o cifras de la semana que ya conozcas? */
  agenda?: string;
  /** ¿Qué fuentes prefieres? */
  fuentes?: string;
  /** ¿Quién quieres que la escriba? Escritor cuyo estilo imita la IA en las notas de esta sección. */
  escritorId?: string;
};

/** Las preguntas, en orden, con su ayuda. `clave` es el campo de BriefSeccion. */
export const PREGUNTAS_SECCION: { clave: keyof BriefSeccion; pregunta: string; ayuda: string }[] = [
  { clave: "temas", pregunta: "¿Qué temas o asuntos te interesan esta semana?", ayuda: "Palabras clave, problemas del sector, personas o entidades. Cuanto más concreto, mejores temas." },
  { clave: "agenda", pregunta: "¿Hay eventos, ferias, decisiones o cifras de la semana que ya conozcas?", ayuda: "Fechas y hechos que la IA no debe perderse (ciclo de vacunación, feria, publicación del DANE…)." },
  { clave: "escritorId", pregunta: "¿Quién quieres que la escriba?", ayuda: "La IA escribe las notas de esta sección con el estilo de esa persona." },
  { clave: "audiencia", pregunta: "¿Para quién escribimos?", ayuda: "Cambia el enfoque y el lenguaje de cada nota." },
  { clave: "generos", pregunta: "¿Qué géneros quieres?", ayuda: "Puedes marcar varios: la IA los reparte entre las notas." },
  { clave: "palabras", pregunta: "¿Cuántas palabras por nota?", ayuda: "Una noticia breve ronda 300–450; un análisis, 600–1.000." },
  { clave: "alcance", pregunta: "¿Cuál es el alcance geográfico?", ayuda: "Colombia, una región, el mundo o una mezcla." },
  { clave: "lugares", pregunta: "¿Regiones, departamentos o países de interés?", ayuda: "Por ejemplo: «Caribe, Meta, Brasil»." },
  { clave: "tono", pregunta: "¿Qué tono?", ayuda: "Se combina con el estilo del escritor elegido." },
  { clave: "fuentes", pregunta: "¿Qué fuentes prefieres que se consulten?", ayuda: "Entidades, gremios o medios de confianza (ICA, FEDEGAN, DANE…)." },
  { clave: "evitar", pregunta: "¿Qué debe evitar la IA?", ayuda: "Enfoques agotados, términos sensibles, temas que ya cubrieron otros." },
];

const t = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : undefined) || undefined;

/** Valida las respuestas de una sección. */
export function sanearBrief(input: unknown): BriefSeccion {
  const b = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: BriefSeccion = {
    temas: t(b.temas, 500), agenda: t(b.agenda, 500), lugares: t(b.lugares, 160), evitar: t(b.evitar, 400), fuentes: t(b.fuentes, 200),
    escritorId: typeof b.escritorId === "string" && /^[0-9a-f-]{36}$/i.test(b.escritorId) ? b.escritorId : undefined,
    audiencia: AUDIENCIAS.find((x) => x === b.audiencia), alcance: ALCANCES.find((x) => x === b.alcance), tono: TONOS.find((x) => x === b.tono),
    palabras: PALABRAS_OPCIONES.find((x) => x === b.palabras),
    generos: (Array.isArray(b.generos) ? (b.generos as unknown[]) : []).filter((g): g is Genero => (Object.keys(GENEROS) as string[]).includes(String(g))).filter((g, i, a) => a.indexOf(g) === i).slice(0, 6),
  };
  if (!out.generos?.length) delete out.generos;
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as BriefSeccion;
}

function briefsSaneados(input: unknown): Record<string, BriefSeccion> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const salida: Record<string, BriefSeccion> = {};
  for (const [slug, v] of Object.entries(input as Record<string, unknown>).slice(0, 40)) {
    if (!/^[\w-]{1,80}$/.test(slug)) continue;
    const b = sanearBrief(v);
    if (Object.keys(b).length) salida[slug] = b;
  }
  return Object.keys(salida).length ? salida : undefined;
}

/** Cuántas de las preguntas de la sección están respondidas. */
export const respondidas = (b: BriefSeccion | undefined) => PREGUNTAS_SECCION.filter((q) => { const v = b?.[q.clave]; return Array.isArray(v) ? v.length > 0 : !!v; }).length;

/** Las respuestas convertidas en texto para la IA (vacío si no hay ninguna). */
export function briefParaPrompt(seccion: string, b: BriefSeccion | undefined): string {
  if (!b || !respondidas({ ...b, escritorId: undefined })) return "";
  return [
    `INDICACIONES DEL CONSEJO PARA LA SECCIÓN «${seccion}» (respétalas):`,
    b.temas && `- Temas de interés: ${b.temas}`,
    b.agenda && `- Agenda ya conocida de la semana: ${b.agenda}`,
    b.audiencia && `- Audiencia: ${b.audiencia}`,
    b.generos?.length && `- Géneros: ${b.generos.map((g) => GENEROS[g]).join(", ")}`,
    b.palabras && `- Extensión: unas ${b.palabras} palabras por nota`,
    b.alcance && `- Alcance: ${b.alcance}${b.lugares ? ` (${b.lugares})` : ""}`,
    !b.alcance && b.lugares && `- Lugares de interés: ${b.lugares}`,
    b.tono && `- Tono: ${b.tono}`,
    b.fuentes && `- Fuentes preferidas: ${b.fuentes}`,
    b.evitar && `- Evitar: ${b.evitar}`,
  ].filter(Boolean).join("\n");
}
