/**
 * Cintillo de la portada (la franja que corre debajo de la cabecera): qué lleva y a qué velocidad. Lo configura el editor en
 * /panel/portada y viaja dentro del diseño de la portada (`HomeLayoutConfig.ticker`), así que se ve en la vista previa, se
 * publica y se deshace igual que el resto. Todo es puro: la portada le pasa lo ya consultado.
 */
export type CintilloFuente = "portada" | "recientes" | "seccion";
export type CintilloMercado = "trm" | "oil" | "cattle";

export type TickerConfig = {
  /** Mostrar el cintillo. */
  activo?: boolean;
  /** De dónde salen los titulares: el orden de la portada, las más recientes o una sección. */
  fuente?: CintilloFuente;
  /** Slug de la sección cuando `fuente` es `seccion`. */
  seccion?: string;
  /** Cuántos titulares (0 = ninguno: solo indicadores y textos propios). */
  cantidad?: number;
  /** Indicadores del mercado que se muestran. */
  mercado?: CintilloMercado[];
  /** Mensajes propios del editor (uno por línea), antes de los indicadores. */
  textos?: string[];
  /** 1 (muy lento) a 10 (muy rápido); 6 equivale a como corría antes. */
  velocidad?: number;
};

export const MERCADO_CINTILLO: { id: CintilloMercado; etiqueta: string }[] = [
  { id: "trm", etiqueta: "Dólar (TRM)" },
  { id: "oil", etiqueta: "Petróleo Brent" },
  { id: "cattle", etiqueta: "Novillo gordo · Medellín" },
];

export const DEFAULT_TICKER: Required<TickerConfig> = {
  activo: true,
  fuente: "portada",
  seccion: "",
  cantidad: 13,
  mercado: ["trm", "oil", "cattle"],
  textos: [],
  velocidad: 6,
};

export const CINTILLO_MAX_TEXTOS = 10;
export const CINTILLO_MAX_TEXTO = 140;

const entero = (v: unknown, min: number, max: number, def: number) => {
  const n = typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
};

/** Valida lo que llegue (acaba en una página pública) y rellena lo que falte con los valores por defecto. */
export function sanitizeTicker(input: unknown): Required<TickerConfig> {
  const t = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const fuente = (["portada", "recientes", "seccion"] as const).find((f) => f === t.fuente) ?? DEFAULT_TICKER.fuente;
  const seccion = typeof t.seccion === "string" && /^[a-z0-9-]{1,80}$/.test(t.seccion) ? t.seccion : "";
  const mercado = Array.isArray(t.mercado)
    ? MERCADO_CINTILLO.map((m) => m.id).filter((id) => (t.mercado as unknown[]).includes(id))
    : DEFAULT_TICKER.mercado;
  const textos = Array.isArray(t.textos)
    ? t.textos
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.replace(/\s+/g, " ").trim().slice(0, CINTILLO_MAX_TEXTO))
        .filter(Boolean)
        .slice(0, CINTILLO_MAX_TEXTOS)
    : [];
  return {
    activo: typeof t.activo === "boolean" ? t.activo : DEFAULT_TICKER.activo,
    fuente,
    seccion: fuente === "seccion" ? seccion : "",
    cantidad: entero(t.cantidad, 0, 20, DEFAULT_TICKER.cantidad),
    mercado,
    textos,
    velocidad: entero(t.velocidad, 1, 10, DEFAULT_TICKER.velocidad),
  };
}

/** Una pieza del cintillo ya lista para pintar. */
export type PiezaCintillo = { clave: string; tipo: "texto" | "mercado" | "nota"; texto: string };

/** Orden: mensajes propios, indicadores y titulares. `mercado` llega ya formateado (etiqueta + valor) con su clave. */
export function piezasDelCintillo(
  cfg: Required<TickerConfig>,
  datos: { mercado: { key: CintilloMercado; texto: string }[]; notas: { slug: string; title: string }[] },
): PiezaCintillo[] {
  return [
    ...cfg.textos.map((t, i): PiezaCintillo => ({ clave: `txt-${i}`, tipo: "texto", texto: t })),
    ...datos.mercado.filter((m) => cfg.mercado.includes(m.key)).map((m): PiezaCintillo => ({ clave: `mer-${m.key}`, tipo: "mercado", texto: m.texto })),
    ...datos.notas.slice(0, cfg.cantidad).map((n): PiezaCintillo => ({ clave: `nota-${n.slug}`, tipo: "nota", texto: n.title })),
  ];
}

/**
 * Segundos que tarda en dar una vuelta. Depende del largo del texto para que «velocidad» signifique lo mismo con 3 titulares
 * que con 20: a 6 corre como antes (~0,048 s por carácter); 1 es seis veces más lento y 10 casi el doble de rápido.
 */
export function duracionDelCintillo(piezas: PiezaCintillo[], velocidad: number): number {
  const caracteres = piezas.reduce((n, p) => n + p.texto.length + 6, 0);
  const segundos = (caracteres * 0.285) / Math.min(10, Math.max(1, velocidad));
  return Math.round(Math.min(400, Math.max(12, segundos)));
}

/** Una línea con lo que lleva el cintillo, para verla aunque su bloque del panel esté cerrado. */
export function resumenCintillo(t: TickerConfig | undefined): string {
  const v = sanitizeTicker(t);
  const titulares = v.cantidad === 0 ? "sin titulares" : `${v.cantidad} titulares`;
  return `${titulares} · ${v.mercado.length} indicadores${v.textos.length ? ` · ${v.textos.length} mensajes` : ""}`;
}
