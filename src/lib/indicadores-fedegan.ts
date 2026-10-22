import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { guardarCifrasPrecios } from "@/lib/observatorio-tablas";
import { cachear } from "@/lib/data-cache";
import { descargarSeguro } from "@/lib/safe-fetch";
import { parsearCsvIndicador, rangoDeMeses, type SerieCsv } from "@/lib/indicadores-csv";

/**
 * Indicadores ganaderos de FEDEGÁN para la portada. Se leen del CSV público que sirve su sistema de estadísticas
 * (el mismo que alimenta las gráficas de contextoganadero.com), para que las cifras sean las oficiales y se
 * actualicen solas. Nunca se escribe al origen. Para sumar un indicador: añadir una fila a `CATALOGO` (el número
 * `pId` y las columnas se ven en `export.jsp` / en el widget de estadisticas.fedegan.org.co).
 */
const ORIGEN = "https://estadisticas.fedegan.org.co/DOC/export.jsp";
const FUENTE = "FEDEGÁN · Sistema de información estadística";
// El origen cambia una vez al mes: seis horas bastan y no lo molestamos en cada visita.
const SEGUNDOS = 6 * 3600;
// Cinco años de historia, para que el rango de fechas de la gráfica tenga de dónde elegir (el origen guarda aún más).
const MESES = 60;

type Entrada = { clave: string; pId: number; columnas: number[]; titulo: string; descripcion: string; series: string[] };

// Los indicadores que se muestran, en este orden. `columnas` son los ids de columna del origen.
const CATALOGO: Entrada[] = [
  {
    clave: "gordo",
    pId: 63,
    columnas: [1],
    titulo: "Ganado gordo",
    descripcion: "Precio promedio registrado en pie, nacional",
    series: ["Colombia"],
  },
  {
    clave: "gordo-ceba",
    pId: 81,
    columnas: [1, 2, 3],
    titulo: "Gordo · macho ceba",
    descripcion: "Precio promedio por región, kilo en pie",
    series: ["Región Caribe", "Magdalena Medio", "Llanos Orientales"],
  },
  {
    clave: "flaco-machos",
    pId: 74,
    columnas: [1, 2, 3],
    titulo: "Flaco · machos",
    descripcion: "Precio promedio por región, subastas ganaderas",
    series: ["Región Caribe", "Magdalena Medio y Santanderes", "Llanos Orientales"],
  },
  {
    clave: "flaco-hembras",
    pId: 75,
    columnas: [1, 2, 3],
    titulo: "Flaco · hembras",
    descripcion: "Precio promedio por región, subastas ganaderas",
    series: ["Región Caribe", "Magdalena Medio y Santanderes", "Llanos Orientales"],
  },
];

/** Un indicador listo para dibujar: meses, series y de dónde sale. */
export type Indicador = {
  clave: string;
  titulo: string;
  descripcion: string;
  unidad: string;
  periodos: string[];
  series: SerieCsv[];
  fuente: string;
};

// Descarga y lee un indicador; `null` si el origen no responde o devuelve algo que no es un CSV de indicador.
async function leerUno(e: Entrada, desde: string, hasta: string): Promise<Indicador | null> {
  const url = new URL(ORIGEN);
  url.search = new URLSearchParams({
    pId: String(e.pId),
    pSd: desde,
    pEd: hasta,
    pCol: ["-1", ...e.columnas].join(","),
    pRow: "-1,1",
  })
    .toString()
    .replace(/%2C/g, ",");
  // Plazo total de 8 s: con el origen atascado la portada no debe quedarse esperándolo.
  const r = await descargarSeguro(url, { maxBytes: 200_000, plazoMs: 8_000, cabeceras: { accept: "text/csv", "user-agent": "CONtextoGanadero/1.0 (indicadores)" } });
  if (!r || !/csv|text\/plain/i.test(r.tipo)) return null;
  const tabla = parsearCsvIndicador(r.cuerpo, e.series);
  if (!tabla) return null;
  return { clave: e.clave, titulo: e.titulo, descripcion: e.descripcion, unidad: "$ por kilo en pie", fuente: FUENTE, ...tabla };
}

// Cuándo falló por última vez la lectura en ESTA instancia: durante `ESPERA_TRAS_FALLO_MS` no se vuelve a pedir al origen (si no, cada
// visita esperaba de nuevo los segundos de plazo de un origen caído).
const ESPERA_TRAS_FALLO_MS = 90_000;
let falloEn = 0;

// Copia en la base de la última lectura completa de los precios: ninguna visita espera las descargas al origen, solo una consulta.
const SNAPSHOT_KEY = "indicadores_snapshot";
const SNAPSHOT_MAX_MS = 36 * 3600 * 1000;

// Lee la copia guardada con su fecha; `null` si no hay o no se puede leer.
async function leerSnapshot(): Promise<{ valor: Indicador[]; en: number } | null> {
  try {
    const [row] = await db.select({ value: siteSettings.value, updatedAt: siteSettings.updatedAt }).from(siteSettings).where(eq(siteSettings.key, SNAPSHOT_KEY)).limit(1);
    const valor = row?.value as Indicador[] | undefined;
    return Array.isArray(valor) && valor.length ? { valor, en: row.updatedAt.getTime() } : null;
  } catch {
    return null;
  }
}

// Lee todo el catálogo del origen. Si falla del todo se lanza (no se guarda una lista vacía).
async function leerDelOrigen(desde: string): Promise<Indicador[]> {
  const { hasta } = rangoDeMeses(new Date(), MESES);
  const todos = await Promise.all(CATALOGO.map((e) => leerUno(e, desde, hasta).catch(() => null)));
  const ok = todos.filter((x): x is Indicador => x !== null);
  if (!ok.length) throw new Error("El origen de indicadores no respondió");
  return ok;
}

/** Vuelve a leer los precios del origen y deja la copia en la base (la llama el cron diario). Devuelve si se guardó. */
export async function refrescarIndicadores(): Promise<boolean> {
  const ok = await leerDelOrigen(rangoDeMeses(new Date(), MESES).desde);
  // Solo se guarda una lectura completa: si faltan indicadores no se pisa la copia buena.
  if (ok.length < CATALOGO.length) return false;
  await guardarSnapshot(ok);
  return true;
}

// Guarda la lectura completa como copia en la base.
async function guardarSnapshot(valor: Indicador[]) {
  await db.insert(siteSettings).values({ key: SNAPSHOT_KEY, value: valor }).onConflictDoUpdate({ target: siteSettings.key, set: { value: valor, updatedAt: sql`now()` } });
  await guardarCifrasPrecios(valor).catch((e) => console.error("indicadores: no se pudieron guardar las cifras en tablas", e));
}

// Orden: copia en la base (una consulta, instantánea) -> si no hay o es muy vieja, el origen. Con el origen caído se prefiere la copia vieja.
const leer = cachear(
  "indicadores-fedegan-v2",
  async (desde: string): Promise<Indicador[]> => {
    const copia = await leerSnapshot();
    if (copia && Date.now() - copia.en < SNAPSHOT_MAX_MS) return copia.valor;
    if (Date.now() - falloEn < ESPERA_TRAS_FALLO_MS) {
      if (copia) return copia.valor;
      throw new Error("El origen de indicadores falló hace poco");
    }
    try {
      const ok = await leerDelOrigen(desde);
      // La primera lectura completa deja la copia: las siguientes visitas (y el cron) ya no esperan al origen.
      if (ok.length >= CATALOGO.length) await guardarSnapshot(ok).catch((e) => console.error("indicadores: no se pudo guardar la copia", e));
      return ok;
    } catch (e) {
      falloEn = Date.now();
      if (copia) return copia.valor;
      throw e;
    }
  },
  { tags: ["indicadores"], segundos: SEGUNDOS },
);

/** Indicadores para la portada; lista vacía (y la sección se oculta) si el origen no está disponible. */
export async function getIndicadores(): Promise<Indicador[]> {
  try {
    return await leer(rangoDeMeses(new Date(), MESES).desde);
  } catch {
    return [];
  }
}
