import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { cachear } from "@/lib/data-cache";
import { descargarSeguro } from "@/lib/safe-fetch";
import { limitador } from "@/lib/en-paralelo";
import { parsearBibliotecas, parsearCsvGeneral, rangoDeMeses, type BibliotecaFuente, type SerieCsv } from "@/lib/indicadores-csv";
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
// El origen se atasca a ratos y no tolera bien las ráfagas: pocas descargas a la vez, un plazo para cada una y un presupuesto para
// el conjunto, de modo que ni siquiera con el origen caído se retiene a un visitante más de unos segundos.
const SIMULTANEAS = 6;
const PLAZO_DESCARGA_MS = 8_000;
const PRESUPUESTO_MS = 15_000;
// Tras una lectura incompleta no se vuelve a tocar el origen durante este tiempo (cada visita repetiría el mismo intento).
const ESPERA_TRAS_FALLO_MS = 90_000;

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
export type Observatorio = { generales: IndicadorGeneral[]; departamental: Departamental[]; hato: Hato[]; documentos: BibliotecaFuente[] };

// Cupo de descargas y tiempo que queda para una lectura completa del origen.
type Lectura = { cupo: ReturnType<typeof limitador>; limite: number; agotado: boolean };

// Descarga un indicador del sistema (CSV en ISO-8859-1) y lo interpreta; `null` si no responde o no es un indicador.
async function bajar(l: Lectura, pId: number, columnas: number[], filas: number[], desde: string, hasta: string) {
  const url = new URL(ORIGEN);
  url.search = `pId=${pId}&pSd=${desde}&pEd=${hasta}&pCol=${["-1", ...columnas].join(",")}&pRow=${["-1", ...filas].join(",")}`;
  const r = await descargar(l, url, 600_000, "text/csv");
  if (!r || !/csv|text\/plain/i.test(r.tipo)) return null;
  return parsearCsvGeneral(r.cuerpo);
}

// Una descarga dentro del cupo y del presupuesto; marca la lectura como incompleta si se quedó sin tiempo.
async function descargar(l: Lectura, url: URL, maxBytes: number, accept: string) {
  return l.cupo(async () => {
    const plazo = Math.min(PLAZO_DESCARGA_MS, l.limite - Date.now());
    if (plazo <= 0) {
      l.agotado = true;
      return null;
    }
    const inicio = Date.now();
    const r = await descargarSeguro(url, { maxBytes, codificacion: "latin1", plazoMs: plazo, cabeceras: { accept, "user-agent": "CONtextoGanadero/1.0 (observatorio)" } });
    if (!r && Date.now() - inicio >= plazo - 50) l.agotado = true;
    return r;
  });
}

// Departamentos tal como los numera el sistema (1 a 34; el 33 es el total nacional).
const COLUMNAS_DEPARTAMENTOS = Array.from({ length: 34 }, (_, i) => i + 1);

/** Una lectura que no llegó a completarse (origen caído o lento): lleva lo que sí se pudo leer, y no se guarda en la caché. */
export class ObservatorioIncompleto extends Error {
  constructor(readonly parcial: Observatorio) {
    super("El origen del Observatorio no respondió a tiempo");
  }
}

// Lee todo el Observatorio del origen, con el cupo y el presupuesto de tiempo de `Lectura`.
async function leerDelOrigen(): Promise<{ valor: Observatorio; incompleto: boolean }> {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const ventana = rangoDeMeses(ahora, MESES_VENTANA);
  const historia = { desde: "01-01-2001", hasta: `31-12-${anio + 1}` };
  const l: Lectura = { cupo: limitador(SIMULTANEAS), limite: Date.now() + PRESUPUESTO_MS, agotado: false };

  const [generales, departamental, hato, documentos] = await Promise.all([
    Promise.all(
      CATALOGO.map(async (e): Promise<IndicadorGeneral | null> => {
        const r = e.frecuencia === "mensual" ? ventana : historia;
        const t = await bajar(l, e.pId, e.columnas, e.filas, r.desde, r.hasta).catch(() => null);
        if (!t) return null;
        const { pId: _p, columnas: _c, filas: _f, frecuencia, ...resto } = e;
        void _p; void _c; void _f;
        return { ...resto, periodos: t.periodos, series: t.series, fuente: FUENTE, mensual: frecuencia === "mensual" };
      }),
    ),
    Promise.all(
      (
        [
          { clave: "bovinos", pId: 2, titulo: "Inventario de bovinos y bufalinos", unidad: "cabezas" },
          { clave: "predios", pId: 87, titulo: "Predios ganaderos", unidad: "predios" },
        ] as const
      ).map(async (d): Promise<Departamental | null> => {
        const t = await bajar(l, d.pId, COLUMNAS_DEPARTAMENTOS, [1], historia.desde, historia.hasta).catch(() => null);
        if (!t) return null;
        const nacional = t.series.find((s) => /nacional/i.test(s.nombre));
        return { clave: d.clave, titulo: d.titulo, unidad: d.unidad, periodos: t.periodos, departamentos: t.series.filter((s) => !/nacional/i.test(s.nombre)), nacional: nacional?.valores ?? [] };
      }),
    ),
    Promise.all(
      (
        [
          { clave: "predios", pId: 98, titulo: "Predios por orientación del hato" },
          { clave: "animales", pId: 99, titulo: "Animales por orientación del hato" },
        ] as const
      ).map(async (h): Promise<Hato | null> => {
        const t = await bajar(l, h.pId, [1], [1, 2, 3, 4, 5, 6, 7], "01-01-2020", `31-12-${anio + 1}`).catch(() => null);
        if (!t) return null;
        const periodo = t.periodos[t.periodos.length - 1];
        const partes = t.series
          .map((s) => ({ nombre: s.nombre, valor: s.valores[t.periodos.length - 1] ?? 0 }))
          .filter((p) => p.valor > 0)
          .sort((a, b) => b.valor - a.valor);
        return partes.length ? { clave: h.clave, titulo: h.titulo, periodo, partes } : null;
      }),
    ),
    // Las bibliotecas de documentos (informes, balances, coyuntura…) vienen en la propia página «General» del sistema.
    (async () => {
      const pagina = new URL("https://estadisticas.fedegan.org.co/Indicadores/66");
      const respuesta = await descargar(l, pagina, 2_500_000, "text/html").catch(() => null);
      return respuesta ? parsearBibliotecas(respuesta.cuerpo, pagina.toString()) : [];
    })(),
  ]);

  return {
    valor: {
      generales: generales.filter((x): x is IndicadorGeneral => x !== null),
      departamental: departamental.filter((x): x is Departamental => x !== null),
      hato: hato.filter((x): x is Hato => x !== null),
      documentos,
    },
    incompleto: l.agotado,
  };
}

const vacio = (o: Observatorio) => !o.generales.length && !o.departamental.length && !o.documentos.length;

// Último intento incompleto de ESTA instancia y cuándo fue: durante `ESPERA_TRAS_FALLO_MS` se devuelve tal cual, sin volver al origen.
let intentoFallido: { en: number; parcial: Observatorio } | null = null;

// La caché de datos sobrevive entre despliegues: si cambia la forma de lo guardado se sube la versión del nombre (v2: se añadieron
// los documentos), y además `normalizar` rellena lo que falte, para que un valor viejo nunca rompa la página.
// Sin argumentos: la ventana de meses se calcula dentro. Con el mes como argumento, el día 1 de cada mes la clave cambiaba y la primera
// visita se quedaba esperando una lectura completa del origen; así, el dato vencido se sirve al instante y se renueva por detrás.
// Si la lectura queda incompleta se lanza `ObservatorioIncompleto`: no se guarda (ni seis horas de gráficas ausentes ni una lista vacía)
// y quien tenía un dato vencido sigue sirviéndolo.
/** Dónde se guarda la última lectura completa del origen: así ninguna visita espera las 15 descargas, solo una consulta a la base. */
const SNAPSHOT_KEY = "observatorio_snapshot";
/** Pasado este tiempo la copia guardada se considera demasiado vieja y se vuelve a leer del origen en la propia visita. */
const SNAPSHOT_MAX_MS = 36 * 3600 * 1000;

// Lee la copia guardada (con su fecha); `null` si no hay, está vacía o no se puede leer.
async function leerSnapshot(): Promise<{ valor: Observatorio; en: number } | null> {
  try {
    const [row] = await db.select({ value: siteSettings.value, updatedAt: siteSettings.updatedAt }).from(siteSettings).where(eq(siteSettings.key, SNAPSHOT_KEY)).limit(1);
    if (!row) return null;
    const valor = normalizar(row.value as Partial<Observatorio>);
    return vacio(valor) ? null : { valor, en: row.updatedAt.getTime() };
  } catch {
    return null;
  }
}

// Guarda la lectura completa del origen como copia en la base.
async function guardarSnapshot(valor: Observatorio) {
  await db.insert(siteSettings).values({ key: SNAPSHOT_KEY, value: valor }).onConflictDoUpdate({ target: siteSettings.key, set: { value: valor, updatedAt: sql`now()` } });
}

/**
 * Vuelve a leer TODO del origen y deja la copia en la base. La llama el cron diario; si la lectura queda incompleta no pisa la
 * copia buena que ya hay. Devuelve si se guardó.
 */
export async function refrescarObservatorio(): Promise<boolean> {
  const { valor, incompleto } = await leerDelOrigen();
  if (incompleto || vacio(valor)) return false;
  await guardarSnapshot(valor).catch((e) => console.error("observatorio: no se pudo guardar la copia", e));
  return true;
}

// La caché de datos sobrevive entre despliegues: si cambia la forma de lo guardado se sube la versión del nombre (v3: ahora sale de
// la copia en la base), y además `normalizar` rellena lo que falte, para que un valor viejo nunca rompa la página.
// Orden: copia en la base (una consulta, instantánea) -> si no hay o es muy vieja, el origen (lento) y se guarda la copia.
// Si la lectura del origen queda incompleta se lanza `ObservatorioIncompleto`: no se guarda en la caché y quien tenía un dato
// vencido sigue sirviéndolo.
const leer = cachear(
  "observatorio-fedegan-v3",
  async (): Promise<Observatorio> => {
    const copia = await leerSnapshot();
    if (copia && Date.now() - copia.en < SNAPSHOT_MAX_MS) return copia.valor;
    if (intentoFallido && Date.now() - intentoFallido.en < ESPERA_TRAS_FALLO_MS) throw new ObservatorioIncompleto(copia?.valor ?? intentoFallido.parcial);
    const { valor, incompleto } = await leerDelOrigen();
    if (incompleto || vacio(valor)) {
      intentoFallido = { en: Date.now(), parcial: valor };
      // Con el origen caído es mejor una copia vieja que una página vacía.
      if (copia) return copia.valor;
      throw new ObservatorioIncompleto(valor);
    }
    intentoFallido = null;
    await guardarSnapshot(valor).catch((e) => console.error("observatorio: no se pudo guardar la copia", e));
    return valor;
  },
  { tags: ["indicadores"], segundos: SEGUNDOS },
);

/** Completa lo que falte en un valor guardado con una versión anterior (listas vacías). */
export function normalizar(o: Partial<Observatorio> | null | undefined): Observatorio {
  return { generales: o?.generales ?? [], departamental: o?.departamental ?? [], hato: o?.hato ?? [], documentos: o?.documentos ?? [] };
}

/** Todo el Observatorio; vacío (y la página lo dice) si el origen no está disponible. */
export async function getObservatorio(): Promise<Observatorio> {
  try {
    return normalizar(await leer());
  } catch (e) {
    // Una lectura incompleta enseña lo que sí llegó (esta visita; la siguiente lo intenta de nuevo pasada la espera).
    return normalizar(e instanceof ObservatorioIncompleto ? e.parcial : null);
  }
}
