import "server-only";
import { cachear } from "@/lib/data-cache";
import { descargarSeguro } from "@/lib/safe-fetch";
import { parsearCsvGeneral, rangoDeMeses, type SerieCsv } from "@/lib/indicadores-csv";
import type { Formato } from "@/lib/graficas";

/**
 * Datos del Observatorio: las mismas gráficas de la página «General» de FEDEGÁN (inventario por departamento,
 * sacrificio, producción mundial de carne, precios internacionales, leche, costos y consumo), leídas del CSV público
 * del sistema de estadísticas (`export.jsp`). Solo lectura. Cada indicador es una fila del catálogo: `pId` es el número
 * interno del sistema; las columnas y filas son los ids que ofrece su formulario (los mismos que usa su página).
 */
const ORIGEN = "https://estadisticas.fedegan.org.co/DOC/export.jsp";
const FUENTE = "FEDEGÁN · Sistema de información estadística";
const SEGUNDOS = 6 * 3600;
const MESES_VENTANA = 60;

/** Grupos temáticos del Observatorio, en el orden en que se muestran. */
export type Grupo = "produccion" | "consumo" | "internacional" | "costos";

type Entrada = {
  clave: string;
  grupo: Grupo;
  titulo: string;
  descripcion: string;
  unidad: string;
  pId: number;
  columnas: number[];
  filas: number[];
  /** «mensual»: los últimos cinco años; «anual»: toda la historia que haya. */
  frecuencia: "mensual" | "anual";
  formato: Formato;
  prefijo?: string;
  forma: "linea" | "area" | "barras";
  /** Series encendidas al abrir (por nombre); si no se indica, todas. */
  destacadas?: string[];
};

const CATALOGO: Entrada[] = [
  { clave: "sacrificio", grupo: "produccion", titulo: "Sacrificio de bovinos", descripcion: "Formal registrado e informal estimado", unidad: "miles de cabezas", pId: 7, columnas: [1, 6], filas: [1], frecuencia: "anual", formato: "entero", forma: "barras" },
  { clave: "carne-mundo", grupo: "produccion", titulo: "Producción mundial de carne bovina", descripcion: "Principales productores", unidad: "miles de toneladas", pId: 12, columnas: [5, 10, 13, 14, 22, 23], filas: [1], frecuencia: "anual", formato: "entero", forma: "linea" },
  { clave: "consumo-carnes", grupo: "consumo", titulo: "Consumo de carnes por habitante", descripcion: "Consumo aparente anual, solo formal", unidad: "kg por habitante", pId: 22, columnas: [2, 3, 4, 6], filas: [1], frecuencia: "anual", formato: "decimal1", forma: "linea" },
  { clave: "consumo-res", grupo: "consumo", titulo: "Consumo de carne de res", descripcion: "Formal reportado, informal estimado y total", unidad: "kg por habitante", pId: 106, columnas: [1, 2, 3], filas: [1], frecuencia: "anual", formato: "decimal1", forma: "barras" },
  { clave: "consumo-leche", grupo: "consumo", titulo: "Consumo de leche por habitante", descripcion: "Consumo aparente anual", unidad: "litros por habitante", pId: 49, columnas: [1], filas: [1], frecuencia: "anual", formato: "entero", forma: "area" },
  { clave: "novillo-paises", grupo: "internacional", titulo: "Novillo gordo en pie: países", descripcion: "Precio mensual comparado", unidad: "US$ por kilo", pId: 9, columnas: [1], filas: [1, 2, 3, 4, 6, 9, 10, 12, 14], frecuencia: "mensual", formato: "decimal2", prefijo: "US$ ", forma: "linea", destacadas: ["Colombia", "Estados Unidos", "Argentina", "Brasil"] },
  { clave: "leche-paises", grupo: "internacional", titulo: "Leche cruda: países", descripcion: "Precio al productor, mensual", unidad: "US$ por litro", pId: 16, columnas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], filas: [1], frecuencia: "mensual", formato: "decimal2", prefijo: "US$ ", forma: "linea", destacadas: ["Colombia (US$/L)", "Estados Unidos (US$/L)", "Unión Europea (US$/L)", "Nueva Zelanda (US$/L)"] },
  { clave: "leche-polvo", grupo: "internacional", titulo: "Leche en polvo entera", descripcion: "Precio internacional por origen", unidad: "US$ por tonelada", pId: 18, columnas: [1], filas: [1, 2, 3, 4], frecuencia: "mensual", formato: "entero", prefijo: "US$ ", forma: "linea" },
  { clave: "carne-deshuesada", grupo: "internacional", titulo: "Carne bovina deshuesada", descripcion: "Precio implícito CIF", unidad: "US$ por tonelada", pId: 17, columnas: [1], filas: [1], frecuencia: "mensual", formato: "entero", prefijo: "US$ ", forma: "area" },
  { clave: "costos", grupo: "costos", titulo: "Índice de costos de producción", descripcion: "Costos de leche, doble propósito, cría y ceba frente al IPC", unidad: "índice", pId: 19, columnas: [1], filas: [1, 2, 3, 4, 5, 6, 7, 8, 9], frecuencia: "anual", formato: "decimal1", forma: "linea" },
];

/** Un indicador del Observatorio, listo para dibujar. */
export type IndicadorGeneral = Omit<Entrada, "pId" | "columnas" | "filas" | "frecuencia"> & {
  periodos: string[];
  series: SerieCsv[];
  fuente: string;
  mensual: boolean;
};

/** Cifra por departamento a lo largo de los años (inventario bovino, predios). */
export type Departamental = { clave: "bovinos" | "predios"; titulo: string; unidad: string; periodos: string[]; departamentos: SerieCsv[]; nacional: (number | null)[] };
/** Reparto de predios o animales por orientación del hato, en un año. */
export type Hato = { clave: "predios" | "animales"; titulo: string; periodo: string; partes: { nombre: string; valor: number }[] };
/** Todo lo que lee el Observatorio. */
export type Observatorio = { generales: IndicadorGeneral[]; departamental: Departamental[]; hato: Hato[] };

// Descarga un indicador del sistema (CSV en ISO-8859-1) y lo interpreta; `null` si no responde o no es un indicador.
async function bajar(pId: number, columnas: number[], filas: number[], desde: string, hasta: string) {
  const url = new URL(ORIGEN);
  url.search = `pId=${pId}&pSd=${desde}&pEd=${hasta}&pCol=${["-1", ...columnas].join(",")}&pRow=${["-1", ...filas].join(",")}`;
  const r = await descargarSeguro(url, { maxBytes: 600_000, codificacion: "latin1", cabeceras: { accept: "text/csv", "user-agent": "CONtextoGanadero/1.0 (observatorio)" } });
  if (!r || !/csv|text\/plain/i.test(r.tipo)) return null;
  return parsearCsvGeneral(r.cuerpo);
}

// Departamentos tal como los numera el sistema (1 a 34; el 33 es el total nacional).
const COLUMNAS_DEPARTAMENTOS = Array.from({ length: 34 }, (_, i) => i + 1);

const leer = cachear(
  "observatorio-fedegan",
  async (desde: string): Promise<Observatorio> => {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    // El argumento de la caché es el primer mes de la ventana: así se renueva sola al cambiar de mes.
    const ventana = { desde, hasta: rangoDeMeses(ahora, MESES_VENTANA).hasta };
    const historia = { desde: "01-01-2001", hasta: `31-12-${anio + 1}` };

    const generales = (
      await Promise.all(
        CATALOGO.map(async (e): Promise<IndicadorGeneral | null> => {
          const r = e.frecuencia === "mensual" ? ventana : historia;
          const t = await bajar(e.pId, e.columnas, e.filas, r.desde, r.hasta).catch(() => null);
          if (!t) return null;
          const { pId: _p, columnas: _c, filas: _f, frecuencia, ...resto } = e;
          void _p; void _c; void _f;
          return { ...resto, periodos: t.periodos, series: t.series, fuente: FUENTE, mensual: frecuencia === "mensual" };
        }),
      )
    ).filter((x): x is IndicadorGeneral => x !== null);

    const departamental = (
      await Promise.all(
        (
          [
            { clave: "bovinos", pId: 2, titulo: "Inventario de bovinos y bufalinos", unidad: "cabezas" },
            { clave: "predios", pId: 87, titulo: "Predios ganaderos", unidad: "predios" },
          ] as const
        ).map(async (d): Promise<Departamental | null> => {
          const t = await bajar(d.pId, COLUMNAS_DEPARTAMENTOS, [1], historia.desde, historia.hasta).catch(() => null);
          if (!t) return null;
          const nacional = t.series.find((s) => /nacional/i.test(s.nombre));
          return { clave: d.clave, titulo: d.titulo, unidad: d.unidad, periodos: t.periodos, departamentos: t.series.filter((s) => !/nacional/i.test(s.nombre)), nacional: nacional?.valores ?? [] };
        }),
      )
    ).filter((x): x is Departamental => x !== null);

    const hato = (
      await Promise.all(
        (
          [
            { clave: "predios", pId: 98, titulo: "Predios por orientación del hato" },
            { clave: "animales", pId: 99, titulo: "Animales por orientación del hato" },
          ] as const
        ).map(async (h): Promise<Hato | null> => {
          const t = await bajar(h.pId, [1], [1, 2, 3, 4, 5, 6, 7], "01-01-2020", `31-12-${anio + 1}`).catch(() => null);
          if (!t) return null;
          const periodo = t.periodos[t.periodos.length - 1];
          const partes = t.series
            .map((s) => ({ nombre: s.nombre, valor: s.valores[t.periodos.length - 1] ?? 0 }))
            .filter((p) => p.valor > 0)
            .sort((a, b) => b.valor - a.valor);
          return partes.length ? { clave: h.clave, titulo: h.titulo, periodo, partes } : null;
        }),
      )
    ).filter((x): x is Hato => x !== null);

    if (!generales.length && !departamental.length) throw new Error("El origen del Observatorio no respondió");
    return { generales, departamental, hato };
  },
  { tags: ["indicadores"], segundos: SEGUNDOS },
);

/** Todo el Observatorio; vacío (y la página lo dice) si el origen no está disponible. */
export async function getObservatorio(): Promise<Observatorio> {
  try {
    return await leer(rangoDeMeses(new Date(), MESES_VENTANA).desde);
  } catch {
    return { generales: [], departamental: [], hato: [] };
  }
}
