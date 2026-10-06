import "server-only";

/**
 * Gráficas del asistente de redacción: a partir del tema y del texto de la nota busca cifras en fuentes confiables y propone
 * una gráfica (barras, líneas o torta) con su fuente; nunca inventa datos.
 */

import { generateObject, generateText, type ToolSet } from "ai";
import { z } from "zod";
import { getGroundedAi } from "@/lib/ai-provider";
import { registrarUsoIA, verificarCuotaIA } from "@/lib/ai-cuota";
import { TIPOS_GRAFICA, aplicarTipo, chartProblem, renderChartSvg, type ChartSpec, type TipoGrafica } from "@/lib/chart-svg";
import { esConfiable, hostFuente, resolverEnlaces } from "@/lib/ai/investigacion";

const chartSchema = z.object({
  enough: z.boolean().describe("false si el texto no trae cifras suficientes para una gráfica"),
  type: z.enum(["bar", "line", "pie"]),
  title: z.string(),
  unit: z.string(),
  labels: z.array(z.string()),
  series: z.array(z.object({ name: z.string(), values: z.array(z.number()) })),
  sourceNote: z.string().describe("Fuente y periodo de las cifras, tal como constan en el texto"),
});

// Resultado de generar una gráfica: su especificación, fuentes y SVG, o un error.
export type ChartResult =
  | { ok: true; chart: ChartSpec; sourceNote: string; sources: { title: string; url: string }[]; svg: string }
  | { ok: false; error: string };

/**
 * Pide a Gemini, con búsqueda en Google, cifras reales y recientes del tema y
 * las convierte en una gráfica. Se rechaza si la búsqueda no devuelve fuentes
 * citables (regla de la casa: nada sin fuente) y la gráfica sale con sus
 * fuentes a la vista para que el periodista las verifique antes de insertarla.
 */
export async function generateChartCore(userId: string, input: { topic: string; section?: string; tipo?: TipoGrafica; /** Texto de la nota ya redactada: la gráfica debe ilustrar sus cifras y su hecho central. */ articulo?: string }): Promise<ChartResult> {
  const topic = input.topic.trim();
  if (topic.length < 10) return { ok: false, error: "Describe qué quieres graficar (mínimo 10 caracteres)." };

  const ai = await getGroundedAi();
  if (!ai) return { ok: false, error: "Falta la clave del modelo (Configuración → Asistente)." };
  if (ai === "otro-proveedor") {
    return { ok: false, error: "Las gráficas con datos reales usan Gemini: elige Google (Gemini) en Configuración → Asistente." };
  }

  try {
    const cuotaIA = await verificarCuotaIA(userId);
    if (!cuotaIA.ok) return { ok: false, error: cuotaIA.message };
    const hoy = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(new Date());
    const FUENTES =
      "Fuentes preferidas (en este orden): DANE, FEDEGAN (cifras de referencia del sector, Fondo Nacional del Ganado), ICA (censo pecuario), Ministerio de Agricultura (Agronet, SIPSA, UPRA, EVA), Banco de la República, Bolsa Mercantil, Fedegán/Fenavi/Asoleche, FAO (FAOSTAT), USDA, OCDE, Banco Mundial.";
    const REGLAS =
      "Devuelve SOLO cifras que aparezcan literalmente en las páginas que consultes, cada una con su unidad, periodo y fuente (nombre y página). Nunca estimes, interpoles, redondees ni inventes números; si una cifra no está, no la incluyas. Prefiere tablas y series históricas oficiales.";
    // Consulta al modelo con búsqueda en Google, registra el gasto y devuelve el texto y las fuentes web que usó.
    const buscar = async (system: string, prompt: string) => {
      const r = await generateText({ model: ai.model, tools: ai.tools as unknown as ToolSet, system, prompt });
      await registrarUsoIA(userId, r.usage);
      const src = r.sources
        .filter((x) => x.sourceType === "url")
        .map((x) => { const host = hostFuente(x.title, x.url); return { title: (x.title && x.title !== host ? `${host}: ${x.title}` : host || x.url).slice(0, 120), url: x.url, host }; });
      return { text: r.text, src };
    };
    const sistema = `Eres un analista de datos de un medio ganadero colombiano. ${FUENTES} ${REGLAS}`;
    const nota = (input.articulo ?? "").replace(/\s+/g, " ").trim().slice(0, 3000);
    const sec = `${input.section ? `SECCIÓN: ${input.section}\n` : ""}${nota ? `NOTA YA REDACTADA (la gráfica debe ilustrar su hecho central y sus cifras): ${nota}\n` : ""}`;
    const tipo: TipoGrafica = input.tipo ?? "auto";
    const GUIA: Record<TipoGrafica, string> = {
      auto: "",
      vertical: "BARRAS: compara de 3 a 8 categorías o periodos de una misma magnitud.",
      horizontal: "BARRAS HORIZONTALES: ranking de 4 a 10 categorías (departamentos, países, razas, destinos…) de una misma magnitud en un mismo periodo.",
      histograma: "HISTOGRAMA: distribución por periodos consecutivos o por rangos (mínimo 5 barras contiguas).",
      line: "LÍNEAS: evolución en el tiempo, mínimo 4 periodos consecutivos (años, meses o trimestres) de la misma magnitud.",
      area: "ÁREA: evolución en el tiempo de un total, mínimo 4 periodos consecutivos.",
      torta: "TORTA: partes de UN total en UN solo periodo (participación por departamento, categoría, destino, raza…), de 3 a 7 partes. Las etiquetas NO pueden ser años.",
      dona: "DONA: partes de UN total en UN solo periodo (participación por departamento, categoría, destino, raza…), de 3 a 7 partes. Las etiquetas NO pueden ser años.",
    };
    const pideForma = GUIA[tipo] ? `FORMA DE GRÁFICA PEDIDA POR EL PERIODISTA — ${GUIA[tipo]} Busca los datos con ESA estructura.\n` : "";

    // Cuatro búsquedas en paralelo, cada una en una familia distinta de fuentes fidedignas: así las cifras se contrastan entre entidades.
    const enfoque = (nombre: string, entidades: string, extra: string) =>
      buscar(sistema, `Hoy es ${hoy}.\n${sec}TEMA A GRAFICAR: ${topic}\n${pideForma}\nBusca SOLO en ${entidades}. ${extra} Lista de 3 a 12 puntos comparables con valor exacto, unidad, periodo y entidad. Si esas entidades no publican nada sobre el tema, responde «sin datos» y no completes con otras fuentes.`).then((r) => ({ ...r, nombre }));
    const busquedas = await Promise.all([
      enfoque("Cifras exactas del tema", "fuentes oficiales o reconocidas del sector (DANE, FEDEGAN, ICA, Ministerio de Agricultura, FAO)", "Busca las cifras EXACTAS del tema."),
      enfoque("Gremios y mercado (FEDEGAN, Fenavi, Asoleche, Bolsa Mercantil)", "FEDEGAN (Fondo Nacional del Ganado, cifras de referencia), Fenavi, Asoleche y la Bolsa Mercantil de Colombia", "Prioriza series de precios, sacrificio, acopio, producción y comercio."),
      enfoque("Estado colombiano (DANE, ICA, MinAgricultura, IDEAM, Banco de la República)", "DANE, ICA (censo pecuario), Ministerio de Agricultura (Agronet, SIPSA, UPRA, EVA), IDEAM y Banco de la República", "Prioriza inventarios, censos, áreas, exportaciones y estadísticas oficiales."),
      enfoque("Organismos internacionales (FAO, USDA, OCDE, Banco Mundial)", "FAO (FAOSTAT), USDA, OCDE, Banco Mundial, CEPAL y WOAH", "Prioriza comparativos con otros países y series globales."),
    ]);
    let texto = `${busquedas.map((b) => `=== ${b.nombre} ===\n${b.text}`).join("\n\n")}${nota ? `\n\nCIFRAS DE LA NOTA REDACTADA:\n${nota}` : ""}`;
    let allSrc = busquedas.flatMap((b) => b.src);

    // Convierte el texto con cifras en la especificación de la gráfica, exigiendo que no se inventen ni cambien valores.
    const armar = async (material: string, estricto: boolean) => {
      const { object, usage } = await generateObject({
        model: ai.model,
        schema: chartSchema,
        prompt: `Con SOLO las cifras del siguiente texto (no agregues ninguna y no cambies ninguna: cada valor debe aparecer en el texto tal cual), arma la gráfica más adecuada (barras para comparar categorías, línea para evolución en el tiempo, torta SOLO para partes de un total). REGLAS DE LA GRÁFICA: (1) todos los valores deben ser de la MISMA magnitud y unidad y comparables entre sí: NUNCA mezcles hectáreas con cabezas de ganado o con pesos en el mismo gráfico; si el texto trae varias magnitudes, elige UNA y grafica solo esa; (2) prefiere una serie en el tiempo o categorías comparables, de 3 a 8 puntos; (3) etiquetas cortas (máx. 22 caracteres) sin repetir la unidad; (4) ordena las categorías de mayor a menor (si no son cronológicas); (5) title = una frase que diga qué muestra (no «Gráfica de…»), unit = la unidad con su periodo (p. ej. «Miles de cabezas, 2025»); (6) sourceNote = la(s) fuente(s) concretas de los datos; (7) la gráfica debe ser CONSECUENTE con la nota: ilustra su hecho central usando, de preferencia, las cifras que la propia nota ya presenta (constan en sus fuentes) y complementa solo con series oficiales del MISMO tema; nunca grafiques datos de otro asunto; (8) usa cifras de DIFERENTES fuentes fidedignas cuando existan (el texto viene dividido por familias de fuentes): cada serie debe provenir de una sola entidad con una misma metodología (no mezcles metodologías en una misma serie); si usas varias entidades nómbralas todas en sourceNote (p. ej. «FEDEGAN; DANE; FAO»); si dos fuentes dan cifras distintas para lo mismo, usa la oficial y menciona la diferencia en sourceNote; ignora las secciones que digan «sin datos». ${estricto ? "Si el tema exacto no tiene serie, usa la serie oficial relacionada más cercana y deja claro en el title qué mide realmente (no digas que mide otra cosa). " : ""}Si no hay cifras suficientes y comparables marca enough=false.${GUIA[tipo] ? ` El periodista ELIGIÓ el tipo «${tipo}» y la gráfica debe construirse así, sin cambiarlo: ${GUIA[tipo]} Si el texto no permite esa estructura marca enough=false.` : ""}\n\nTEMA: ${topic}\n\nTEXTO:\n${material.slice(0, 9000)}`,
      });
      await registrarUsoIA(userId, usage);
      return object;
    };
    /** Una cifra está respaldada si aparece en el texto de las fuentes (con formato latino o inglés, o escalada a miles/millones). */
    const respaldada = (v: number, t: string) => {
      const abs = Math.abs(v);
      const f = new Set<string>();
      for (const base of [abs, abs / 1000, abs / 1_000_000]) {
        if (!Number.isFinite(base) || base === 0) continue;
        for (const dec of [0, 1, 2]) {
          const n = Number(base.toFixed(dec));
          if (Math.abs(n - base) > base * 0.0005 + 1e-9) continue;
          for (const loc of ["es-CO", "en-US"]) f.add(n.toLocaleString(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec }));
          f.add(n.toFixed(dec)); f.add(n.toFixed(dec).replace(".", ","));
        }
      }
      return [...f].some((x) => x.length > 0 && new RegExp(`(?<![\\d.,])${x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d|[.,]\\d)`).test(t));
    };
    // Comprueba que al menos el 80 % de los valores de la gráfica aparezcan en el texto de respaldo.
    const verificada = (o: Awaited<ReturnType<typeof armar>>, t: string) => {
      const vals = o.series.flatMap((x) => x.values);
      if (!vals.length) return false;
      return vals.filter((v) => respaldada(v, t)).length / vals.length >= 0.8;
    };

    // Comprueba que la gráfica tenga suficientes datos para el tipo pedido (torta, líneas, histograma o barras).
    const adecuada = (o: Awaited<ReturnType<typeof armar>>) => {
      const n = o.labels.length;
      if (tipo === "torta" || tipo === "dona") return n >= 3 && n <= 8 && !o.labels.every((l) => /^(19|20)\d{2}/.test(l.trim())) && (o.series[0]?.values ?? []).every((v) => v > 0);
      if (tipo === "line" || tipo === "area") return n >= 4;
      if (tipo === "histograma") return n >= 5;
      return n >= 3;
    };
    let object = await armar(texto, false);
    if (!object.enough || !verificada(object, texto) || !adecuada(object)) {
      // Segundo intento: búsqueda más amplia (datos macro del sector) y reglas más flexibles con el tema, nunca con los números.
      const amplia = await buscar(
        sistema,
        `Hoy es ${hoy}.\n${sec}TEMA DE LA NOTA: ${topic}\n${pideForma}\nNo encontré cifras con la estructura pedida. Busca en las fuentes oficiales (DANE, FEDEGAN, ICA, Agronet/SIPSA, FAO) los datos del sector ganadero colombiano (o mundial si aplica) MÁS RELACIONADOS con ese tema que tengan una serie anual o mensual de 4 o más valores (inventario, precios, producción, exportaciones, sacrificio, leche acopiada, clima/área afectada). Copia los valores tal cual con su fuente y año.`,
      );
      texto = `${texto}\n\n${amplia.text}`;
      allSrc = [...allSrc, ...amplia.src];
      object = await armar(texto, true);
    }
    const unicas = allSrc.filter((x, k, arr) => arr.findIndex((y) => y.url === x.url) === k);
    // Una fuente por dominio, las oficiales y reconocidas primero: la gráfica debe apoyarse en entidades distintas.
    const porHost = unicas.filter((x, k, arr) => arr.findIndex((y) => y.host === x.host) === k);
    const sources = [...porHost.filter((x) => esConfiable(x.host)), ...porHost.filter((x) => !esConfiable(x.host))].slice(0, 8).map(({ title, url }) => ({ title, url }));
    if (porHost.length < 2) {
      return { ok: false, error: "Solo hallé una fuente para ese tema; para una gráfica fiable necesito cifras de al menos dos fuentes distintas (p. ej. FEDEGAN, DANE, ICA, FAO). Prueba con un dato más conocido, como «inventario bovino de Colombia 2019–2024»." };
    }
    if (!sources.length) {
      return { ok: false, error: "La búsqueda no devolvió fuentes citables para ese tema, así que no se genera la gráfica. Prueba describiendo el dato concreto (p. ej. «inventario bovino de Colombia 2019–2024»)." };
    }
    if (object.enough && !adecuada(object)) {
      const nombre = TIPOS_GRAFICA.find((x) => x.id === tipo)?.label ?? tipo;
      return { ok: false, error: `No hallé datos con la estructura que necesita una gráfica de tipo «${nombre}» (${GUIA[tipo].replace(/^[A-ZÁÉÍÓÚ ]+: /, "").toLowerCase()}). Prueba con otro tipo o con un dato distinto.` };
    }
    if (!object.enough) return { ok: false, error: "Busqué en fuentes oficiales (DANE, FEDEGAN, ICA, FAO…) y no hallé una serie de cifras comparables para ese tema. Prueba con el dato concreto que quieres mostrar, por ejemplo «precio del kilo de novillo gordo en 2025» o «exportaciones de carne bovina de Colombia 2020–2024»." };
    if (!verificada(object, texto)) return { ok: false, error: "Encontré cifras, pero no pude confirmar que cada valor aparezca en las fuentes citadas, así que no genero la gráfica (regla de la casa: solo datos verificables). Prueba con un dato más concreto o inserta la gráfica manual con tus cifras." };

    const base: ChartSpec = { type: object.type, title: object.title.slice(0, 110), unit: object.unit.slice(0, 70), labels: object.labels.slice(0, 12).map((l) => l.slice(0, 30)), series: object.series.slice(0, 4), source: object.sourceNote.slice(0, 160) };
    // Si quien redacta eligió una forma concreta (torta, histograma…), se aplica sobre los datos encontrados.
    const forma = aplicarTipo(base, input.tipo ?? "auto");
    if (!forma.ok) return { ok: false, error: forma.error };
    const chart = forma.chart;
    const problem = chartProblem(chart);
    if (problem) return { ok: false, error: `Los datos no sirven para graficar: ${problem}` };
    return { ok: true, chart, sourceNote: object.sourceNote.slice(0, 160), sources: await resolverEnlaces(sources), svg: renderChartSvg(chart) };
  } catch (err) {
    console.error("generateChart:", err);
    const detalle = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: detalle ? `No se pudo generar la gráfica: ${detalle.slice(0, 220)}` : "El modelo no respondió." };
  }
}

/* --------------------------------------------------------------------------
 * Temas sugeridos por la IA a partir de la tendencia en internet
 * -------------------------------------------------------------------------- */
