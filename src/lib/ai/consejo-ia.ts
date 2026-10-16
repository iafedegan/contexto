import "server-only";

/**
 * IA del consejo de redacción semanal: propone temas (con búsqueda y fuentes) y arma la pauta, es decir, decide qué cubre cada casilla de
 * la parrilla. Las fechas, horas y cuotas las pone el código (src/lib/consejo/plan.ts); la IA solo propone TEMA, ENFOQUE y ENCARGO de
 * cada casilla, sin inventar hechos: el encargo dice qué contar y qué datos y fuentes hay que confirmar.
 */
import { randomUUID } from "node:crypto";
import { generateObject } from "ai";
import { z } from "zod";
import { getAiModel } from "@/lib/ai-provider";
import { registrarUsoIA, verificarCuotaIA } from "@/lib/ai-cuota";
import { suggestTopicIdeasCore } from "@/lib/ai/ideas-noticias";
import { sumarDias, type TemaConsejo } from "@/lib/consejo/plan";

const esquemaPauta = z.object({
  casillas: z.array(
    z.object({
      i: z.number().int().describe("Número de la casilla tal como llegó"),
      tema: z.string().describe("Titular tentativo de la nota (claro, máx. 110 caracteres)"),
      angulo: z.string().describe("Enfoque periodístico: qué contar y a quién le importa"),
      encargo: z.string().describe("Encargo para quien redacta: qué hechos desarrollar y QUÉ DATOS Y FUENTES HAY QUE CONFIRMAR (sin inventar cifras)"),
      prioridad: z.number().int().min(1).max(3).describe("1 = importante o urgente, 2 = normal, 3 = de apoyo o atemporal"),
    }),
  ),
});

/** Una casilla de la parrilla tal como se le presenta a la IA. */
export type CasillaParaIa = { i: number; cuando: string; seccion: string; prioridad: number };
export type PautaCasilla = { i: number; tema: string; angulo: string; encargo: string; prioridad: 1 | 2 | 3 };

/**
 * Temas candidatos para una sección de la semana, con búsqueda en la web y fuentes (Gemini). Trae hasta `cantidad` temas distintos
 * (cada búsqueda da de 5 a 8, así que si hacen falta más se repite una vez pidiendo otros). Cada tema queda en esa sección.
 */
export async function proponerTemasConsejoCore(
  userId: string,
  input: { lunes: string; enfoque?: string; seccion?: { slug: string; name: string }; cantidad?: number; yaTiene?: string[] },
): Promise<{ ok: true; temas: TemaConsejo[]; fuentes: { title: string; url: string }[] } | { ok: false; error: string }> {
  const domingo = sumarDias(input.lunes, 6);
  const quiere = Math.min(20, Math.max(1, input.cantidad ?? 6));
  const visto = new Set((input.yaTiene ?? []).map((t) => t.toLowerCase()));
  const temas: TemaConsejo[] = [];
  const fuentes: { title: string; url: string }[] = [];
  let ultimoError = "";
  for (let intento = 0; intento < 2 && temas.length < quiere; intento++) {
    const otros = [...visto].slice(0, 12).map((t) => `«${t}»`).join(", ");
    const r = await suggestTopicIdeasCore(userId, {
      section: input.seccion?.name,
      focus: `Agenda y temas para la semana del ${input.lunes} al ${domingo}${input.seccion ? ` en la sección «${input.seccion.name}»` : ""}: eventos, ferias, publicaciones de cifras (DANE, FEDEGAN, ICA), decisiones de política, clima y mercados que se esperan.${input.enfoque?.trim() ? ` ${input.enfoque.trim()}` : ""}${otros ? ` NO repitas estos temas ya elegidos: ${otros}.` : ""}`,
    });
    if (!r.ok) { ultimoError = r.error; break; }
    for (const i of r.ideas) {
      const k = i.title.toLowerCase();
      if (visto.has(k) || temas.length >= quiere) continue;
      visto.add(k);
      temas.push({ id: randomUUID(), texto: i.title, seccion: input.seccion?.slug, prioridad: 2, origen: "ia", angulo: i.angle });
    }
    for (const f of r.sources) if (!fuentes.some((x) => x.url === f.url)) fuentes.push(f);
  }
  if (!temas.length) return { ok: false, error: ultimoError || "La IA no encontró temas nuevos para esa sección." };
  return { ok: true, temas, fuentes };
}

/** El editor jefe reparte los temas en las casillas de la semana. Devuelve la pauta de cada casilla que logró llenar. */
export async function armarPautaCore(
  userId: string,
  input: { lunes: string; casillas: CasillaParaIa[]; temas: TemaConsejo[]; enfoque?: string },
): Promise<{ ok: true; pauta: PautaCasilla[] } | { ok: false; error: string }> {
  const model = await getAiModel();
  if (!model) return { ok: false, error: "Falta la clave del modelo de IA (la conecta un administrador en Configuración → Asistente)." };
  if (!input.casillas.length) return { ok: false, error: "La parrilla está vacía: elige días, horas y cuántas notas por sección." };
  const cuota = await verificarCuotaIA(userId);
  if (!cuota.ok) return { ok: false, error: cuota.message };

  const hoy = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(new Date());
  const temas = input.temas.map((t, n) => `${n + 1}. ${t.texto}${t.seccion ? ` [sección: ${t.seccion}]` : ""}${t.angulo ? ` — enfoque: ${t.angulo}` : ""}${t.prioridad === 1 ? " (PRIORITARIO)" : ""}`).join("\n");
  const sistema =
    "Eres el editor jefe de CONtexto Ganadero, un medio colombiano del sector ganadero y agropecuario, y diriges el consejo de redacción semanal. " +
    "Tu trabajo es repartir la cobertura de la semana: qué se publica en cada casilla (día, hora y sección ya definidos), con qué enfoque y con qué encargo para quien redacta. " +
    "Criterios de un consejo de redacción real: (1) lo urgente y de mayor impacto sale temprano y en días fuertes; el análisis, los explicativos y los temas atemporales, a media tarde y en la noche o el fin de semana; " +
    "(2) no repetir el mismo hecho en dos casillas: si un tema merece dos piezas, la segunda va con otro ángulo (consecuencia para el productor, antecedentes, voces del sector); " +
    "(3) mezclar lo local y lo internacional y variar los formatos (noticia, explicativo, análisis, datos); (4) respetar la sección de cada casilla; " +
    "(5) usar primero los temas que trae el consejo y completar el resto con temas de la agenda del sector, sin inventar hechos, cifras, fechas ni declaraciones. " +
    "El encargo debe decir qué desarrollar y qué datos y fuentes confirmar (entidad, publicación o persona), nunca afirmar cifras. Español de Colombia.";

  const pauta: PautaCasilla[] = [];
  const yaPlaneado: string[] = [];
  const LOTE = 18;
  try {
    for (let k = 0; k < input.casillas.length; k += LOTE) {
      const lote = input.casillas.slice(k, k + LOTE);
      const lista = lote.map((c) => `#${c.i} · ${c.cuando} · sección ${c.seccion}`).join("\n");
      const { object, usage } = await generateObject({
        model,
        schema: esquemaPauta,
        system: sistema,
        temperature: 0.5,
        abortSignal: AbortSignal.timeout(90_000),
        prompt: [
          `Hoy es ${hoy}. Semana del ${input.lunes}.`,
          input.enfoque?.trim() ? `PEDIDO DEL CONSEJO: ${input.enfoque.trim().slice(0, 600)}` : "",
          temas ? `TEMAS QUE EL CONSEJO QUIERE CUBRIR (úsalos primero, en la sección que corresponda):\n${temas}` : "El consejo no trajo temas: propón los de la agenda del sector para esta semana.",
          yaPlaneado.length ? `YA PLANEADO EN ESTA SEMANA (no repetir hechos):\n${yaPlaneado.map((x) => `- ${x}`).join("\n")}` : "",
          `CASILLAS A LLENAR (devuelve una entrada por cada número #i, sin saltarte ninguna):\n${lista}`,
        ].filter(Boolean).join("\n\n"),
      });
      await registrarUsoIA(userId, usage);
      const validas = new Set(lote.map((c) => c.i));
      for (const c of object.casillas) {
        if (!validas.has(c.i) || pauta.some((p) => p.i === c.i)) continue;
        const tema = c.tema.trim().slice(0, 160);
        if (tema.length < 8) continue;
        pauta.push({ i: c.i, tema, angulo: c.angulo.trim().slice(0, 400), encargo: c.encargo.trim().slice(0, 1200), prioridad: (c.prioridad === 1 || c.prioridad === 3 ? c.prioridad : 2) as 1 | 2 | 3 });
        yaPlaneado.push(tema);
      }
    }
  } catch (err) {
    console.error("armarPautaCore:", err);
    if (!pauta.length) {
      const detalle = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
      return { ok: false, error: detalle ? `El proveedor rechazó la petición: ${detalle.slice(0, 220)}` : "El modelo no respondió." };
    }
  }
  if (!pauta.length) return { ok: false, error: "La IA no devolvió una pauta utilizable; inténtalo de nuevo." };
  return { ok: true, pauta };
}
