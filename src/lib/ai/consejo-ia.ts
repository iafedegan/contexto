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
import { investigarTema } from "@/lib/ai/investigacion";
import { ALCANCES, AUDIENCIAS, GENEROS, PALABRAS_OPCIONES, TONOS, VIGENCIAS, briefParaPrompt, respondidas, sanearBrief, type BriefSeccion, sanearFicha, sumarDias, type FichaPauta, type Genero, type TemaConsejo, type Vigencia } from "@/lib/consejo/plan";

const esquemaPauta = z.object({
  casillas: z.array(
    z.object({
      i: z.number().int().describe("Número de la casilla tal como llegó"),
      temaNumero: z.number().int().describe("Número del tema del consejo (el de la lista TEMAS) en que se basa esta casilla; 0 si es de la agenda y no hay tema"),
      tema: z.string().describe("Titular tentativo de la nota (claro, máx. 110 caracteres)"),
      angulo: z.string().describe("Enfoque periodístico: qué contar y a quién le importa"),
      encargo: z.string().describe("Encargo para quien redacta: qué hechos desarrollar y QUÉ DATOS Y FUENTES HAY QUE CONFIRMAR (sin inventar cifras)"),
      prioridad: z.number().int().min(1).max(3).describe("1 = importante o urgente, 2 = normal, 3 = de apoyo o atemporal"),
      // Ficha de pauta: lo que un consejo de redacción deja definido antes de encargar la nota.
      foco: z.string().describe("La nota en UNA frase: «alguien hace algo porque…»"),
      porQueAhora: z.string().describe("Por qué esta semana: el hecho, la fecha o la decisión que la justifica (sin inventar)"),
      audiencia: z.string().describe("A quién le importa y qué cambia para esa persona"),
      genero: z.enum(Object.keys(GENEROS) as [Genero, ...Genero[]]),
      preguntas: z.array(z.string()).describe("2 a 4 preguntas que la nota debe responder"),
      fuentes: z.array(z.object({ nombre: z.string(), tipo: z.enum(["voz", "documento"]) })).describe("1 a 3 fuentes previstas: entidades, documentos oficiales o tipos de voz a consultar (sin inventar nombres de personas)"),
      datosAConfirmar: z.array(z.string()).describe("Cifras o hechos que hay que confirmar antes de afirmarlos"),
      riesgos: z.array(z.string()).describe("Riesgos o sensibilidades (réplica, presunción de inocencia, alertas sanitarias…); vacío si no hay"),
      palabraClave: z.string().describe("Lo que un ganadero escribiría en el buscador"),
      vigencia: z.enum(Object.keys(VIGENCIAS) as [Vigencia, ...Vigencia[]]),
    }),
  ),
});

/** Una casilla de la parrilla tal como se le presenta a la IA. */
export type CasillaParaIa = { i: number; cuando: string; seccion: string; prioridad: number };
export type PautaCasilla = { i: number; temaN: number; tema: string; angulo: string; encargo: string; prioridad: 1 | 2 | 3; ficha: FichaPauta };

/**
 * Temas candidatos para una sección de la semana, con búsqueda en la web y fuentes (Gemini). Trae hasta `cantidad` temas distintos
 * (cada búsqueda da de 5 a 8, así que si hacen falta más se repite una vez pidiendo otros). Cada tema queda en esa sección.
 */
export async function proponerTemasConsejoCore(
  userId: string,
  input: { lunes: string; enfoque?: string; seccion?: { slug: string; name: string }; cantidad?: number; yaTiene?: string[]; /** Diagnóstico de estilo del escritor elegido. */ estilo?: string },
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
      estilo: input.estilo,
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
  input: { lunes: string; casillas: CasillaParaIa[]; temas: TemaConsejo[]; enfoque?: string; /** Respuestas del consejo a las preguntas de cada sección, ya en texto, por slug. */ briefs?: Record<string, string>; /** Diagnóstico de estilo por sección (slug): quién escribe y cómo. */ estilos?: Record<string, string> },
): Promise<{ ok: true; pauta: PautaCasilla[] } | { ok: false; error: string }> {
  const model = await getAiModel();
  if (!model) return { ok: false, error: "Falta la clave del modelo de IA (la conecta un administrador en Configuración → Asistente)." };
  if (!input.casillas.length) return { ok: false, error: "La parrilla está vacía: elige días, horas y cuántas notas por sección." };
  const cuota = await verificarCuotaIA(userId);
  if (!cuota.ok) return { ok: false, error: cuota.message };

  const hoy = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(new Date());
  const temas = input.temas.map((t, n) => `${n + 1}. ${t.texto}${t.seccion ? ` [sección: ${t.seccion}]` : ""}${t.angulo ? ` — enfoque: ${t.angulo}` : ""}${t.prioridad === 1 ? " (PRIORITARIO)" : ""}${t.brief && respondidas({ ...t.brief, escritorId: undefined }) ? `\n   ${briefParaPrompt(t.texto, t.brief).split("\n").slice(1).join("\n   ")}` : ""}`).join("\n");
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
          Object.keys(input.briefs ?? {}).length ? `INDICACIONES DEL CONSEJO POR SECCIÓN (las respuestas del consejo mandan sobre tu criterio):\n${Object.entries(input.briefs ?? {}).map(([slug, txt]) => `[${slug}]\n${txt}`).join("\n\n")}` : "",
          Object.keys(input.estilos ?? {}).length ? `ESCRITOR Y ESTILO POR SECCIÓN (el encargo y el ángulo de cada casilla deben encajar con la voz de quien la escribe):\n${Object.entries(input.estilos ?? {}).map(([slug, txt]) => `[${slug}]\n${txt}`).join("\n\n")}` : "",
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
        pauta.push({
          i: c.i, temaN: Math.max(0, Math.round(c.temaNumero) || 0), tema, angulo: c.angulo.trim().slice(0, 400), encargo: c.encargo.trim().slice(0, 1200), prioridad: (c.prioridad === 1 || c.prioridad === 3 ? c.prioridad : 2) as 1 | 2 | 3,
          ficha: sanearFicha({ foco: c.foco, porQueAhora: c.porQueAhora, audiencia: c.audiencia, genero: c.genero, preguntas: c.preguntas, fuentes: c.fuentes, datosAConfirmar: c.datosAConfirmar, riesgos: c.riesgos, palabraClave: c.palabraClave, vigencia: c.vigencia, novedad: c.angulo }),
        });
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

const esquemaFicha = z.object({
  foco: z.string(), porQueAhora: z.string(), audiencia: z.string(), novedad: z.string().describe("Qué aporta frente a lo ya publicado, SOLO si se desprende del dossier; si no, cadena vacía"),
  genero: z.enum(Object.keys(GENEROS) as [Genero, ...Genero[]]),
  preguntas: z.array(z.string()).describe("3 a 5 preguntas que la nota debe responder, contestables con el dossier"),
  abiertas: z.array(z.string()).describe("Lo que el dossier NO responde (se dirá que no se sabe)"),
  fuentes: z.array(z.object({ nombre: z.string(), tipo: z.enum(["voz", "documento"]), url: z.string().describe("Enlace de la fuente tal como consta en el dossier, o cadena vacía") })),
  datosAConfirmar: z.array(z.string()), riesgos: z.array(z.string()), palabraClave: z.string(), vigencia: z.enum(Object.keys(VIGENCIAS) as [Vigencia, ...Vigencia[]]),
});

/**
 * Completa la ficha de una casilla con INVESTIGACIÓN real (búsqueda con fuentes): primero se consulta la web, y la ficha se llena solo con lo que
 * consta en ese dossier. Las fuentes llevan su enlace; lo que no se encuentra va a «lo que aún no se sabe». Mantiene lo que el editor ya escribió.
 */
export async function completarFichaCore(
  userId: string,
  input: { tema: string; angulo?: string; encargo?: string; seccion?: string; existente?: FichaPauta; estilo?: string },
): Promise<{ ok: true; ficha: FichaPauta } | { ok: false; error: string }> {
  const model = await getAiModel();
  if (!model) return { ok: false, error: "Falta la clave del modelo de IA (la conecta un administrador en Configuración → Asistente)." };
  const cuota = await verificarCuotaIA(userId);
  if (!cuota.ok) return { ok: false, error: cuota.message };
  try {
    const inv = await investigarTema(userId, input.tema, [input.angulo, input.encargo].filter(Boolean).join(". "), input.seccion);
    if (!inv || !inv.sources.length) return { ok: false, error: "No encontré fuentes verificables para ese tema: no puedo completar la ficha sin inventar. Precisa el tema o añade las fuentes a mano." };
    const { object, usage } = await generateObject({
      model,
      schema: esquemaFicha,
      temperature: 0.2,
      abortSignal: AbortSignal.timeout(60_000),
      system:
        "Eres el editor jefe de CONtexto Ganadero (medio colombiano del sector ganadero y agropecuario). Antes de encargar una nota llenas su FICHA DE PAUTA, como en un consejo de redacción. " +
        "Te basas SOLO en el dossier que recibes: no inventes cifras, fechas, cargos, nombres de personas ni enlaces. Si el dossier no responde algo, ponlo en «abiertas». " +
        "Las fuentes deben ser entidades, documentos o personas que consten en el dossier, con el enlace tal como aparece. Escribe en español de Colombia." + (input.estilo ? `\n\nLa nota la escribirá este escritor; adapta el enfoque, el género y las preguntas a su voz:\n${input.estilo}` : ""),
      prompt: `TEMA: ${input.tema}
${input.angulo ? `ENFOQUE PROPUESTO: ${input.angulo}
` : ""}${input.seccion ? `SECCIÓN: ${input.seccion}
` : ""}
DOSSIER (búsqueda web con fuentes: ${inv.sources.map((x) => `${x.outlet} ${x.url}`).join("; ")}):
${inv.text.slice(0, 9000)}

Llena la ficha de pauta.`,
    });
    await registrarUsoIA(userId, usage);
    const nueva = sanearFicha({ ...object, novedad: object.novedad });
    // Lo que el editor ya escribió manda; la IA solo rellena lo vacío (y suma fuentes nuevas con enlace).
    const previa = sanearFicha(input.existente ?? {});
    const fuentes = [...(previa.fuentes ?? []), ...(nueva.fuentes ?? []).filter((f) => !(previa.fuentes ?? []).some((p) => p.nombre.toLowerCase() === f.nombre.toLowerCase()))].slice(0, 10);
    return { ok: true, ficha: { ...nueva, ...previa, ...(fuentes.length ? { fuentes } : {}) } };
  } catch (err) {
    console.error("completarFichaCore:", err);
    const detalle = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: detalle ? `No se pudo completar la ficha: ${detalle.slice(0, 200)}` : "El modelo no respondió." };
  }
}

const esquemaPreguntas = z.object({
  agenda: z.string().describe("Eventos, ferias, decisiones o cifras de la semana ligados al tema, SOLO si el tema los menciona; si no, cadena vacía"),
  audiencia: z.enum(AUDIENCIAS), palabras: z.number().describe("300, 450, 600, 800 o 1000"),
  generos: z.array(z.enum(Object.keys(GENEROS) as [Genero, ...Genero[]])).describe("1 a 2 géneros"),
  alcance: z.enum(ALCANCES), lugares: z.string().describe("Regiones, departamentos o países, solo si el tema los menciona; si no, cadena vacía"),
  tono: z.enum(TONOS), fuentes: z.string().describe("Entidades o medios de confianza a consultar (ICA, FEDEGAN, DANE…), sin enlaces inventados"),
  evitar: z.string().describe("Enfoques o errores a evitar con este tema, breve"),
});

/** Contesta las preguntas de un tema a partir de su descripción, para que el editor solo corrija. No investiga ni inventa hechos: lo que el tema no dice queda vacío. */
export async function autollenarPreguntasCore(
  userId: string,
  input: { tema: string; seccion: string; estilo?: string },
): Promise<{ ok: true; brief: BriefSeccion } | { ok: false; error: string }> {
  const model = await getAiModel();
  if (!model) return { ok: false, error: "Falta la clave del modelo de IA (la conecta un administrador en Configuración → Asistente)." };
  const cuota = await verificarCuotaIA(userId);
  if (!cuota.ok) return { ok: false, error: cuota.message };
  try {
    const { object, usage } = await generateObject({
      model,
      schema: esquemaPreguntas,
      temperature: 0.3,
      abortSignal: AbortSignal.timeout(45_000),
      system:
        "Eres el editor jefe de CONtexto Ganadero (medio colombiano del sector ganadero y agropecuario). Un editor te describe un tema y tú contestas las preguntas previas del consejo de redacción: " +
        "para quién se escribe, extensión, género, alcance, tono, fuentes a consultar y qué evitar. No inventes hechos, cifras, fechas ni enlaces: lo que el tema no menciona va vacío. Español de Colombia." +
        (input.estilo ? `\n\nLa nota la escribirá este escritor; el tono y el género deben encajar con su voz:\n${input.estilo}` : ""),
      prompt: `SECCIÓN: ${input.seccion}\nTEMA: ${input.tema.slice(0, 400)}`,
    });
    await registrarUsoIA(userId, usage);
    const b = sanearBrief({ ...object, palabras: PALABRAS_OPCIONES.reduce((a, x) => (Math.abs(x - object.palabras) < Math.abs(a - object.palabras) ? x : a), PALABRAS_OPCIONES[0]) });
    return { ok: true, brief: b };
  } catch (err) {
    console.error("autollenarPreguntasCore:", err);
    const detalle = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: `La IA no pudo completar las preguntas${detalle ? `: ${detalle.slice(0, 200)}` : ""}. Intenta de nuevo.` };
  }
}
