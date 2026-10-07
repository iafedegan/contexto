import "server-only";
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
  const r = await descargarSeguro(url, { maxBytes: 200_000, cabeceras: { accept: "text/csv", "user-agent": "CONtextoGanadero/1.0 (indicadores)" } });
  if (!r || !/csv|text\/plain/i.test(r.tipo)) return null;
  const tabla = parsearCsvIndicador(r.cuerpo, e.series);
  if (!tabla) return null;
  return { clave: e.clave, titulo: e.titulo, descripcion: e.descripcion, unidad: "$ por kilo en pie", fuente: FUENTE, ...tabla };
}

// Lee todo el catálogo. Sin try/catch por fuera: si el origen falla del todo se lanza, y así NO se guarda en la caché
// una lista vacía durante seis horas. El argumento (el primer mes del rango) renueva la caché sola al cambiar de mes.
const leer = cachear(
  "indicadores-fedegan",
  async (desde: string): Promise<Indicador[]> => {
    const { hasta } = rangoDeMeses(new Date(), MESES);
    const todos = await Promise.all(CATALOGO.map((e) => leerUno(e, desde, hasta).catch(() => null)));
    const ok = todos.filter((x): x is Indicador => x !== null);
    if (!ok.length) throw new Error("El origen de indicadores no respondió");
    return ok;
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
