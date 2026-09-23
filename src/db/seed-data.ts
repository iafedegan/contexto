/**
 * Datos de arranque compartidos (PGlite local y Postgres gestionado).
 * Idempotente: usa onConflictDoNothing y comprueba si ya hay contenido.
 */
import bcrypt from "bcryptjs";
import type { db as DbType } from "./index";
import * as schema from "./schema";

type AnyDb = typeof DbType;

const CATS = [
  {
    slug: "economia-y-mercados",
    name: "Economía y mercados",
    description: "Precios, exportaciones e indicadores del sector.",
    legacyPaths: ["/economia", "/mercados"],
    sortOrder: 1,
  },
  {
    slug: "regiones",
    name: "Regiones",
    description: "Noticias de las zonas ganaderas del país.",
    legacyPaths: ["/regiones"],
    sortOrder: 2,
  },
  {
    slug: "sostenibilidad",
    name: "Sostenibilidad",
    description: "Ganadería sostenible, clima y ambiente.",
    legacyPaths: ["/ganaderia-sostenible"],
    sortOrder: 3,
  },
  {
    slug: "politica-gremial",
    name: "Política gremial",
    description: "Fedegán, gobierno y normativa que afecta al productor.",
    legacyPaths: ["/politica"],
    sortOrder: 4,
  },
  {
    slug: "ciencia-y-tecnologia",
    name: "Ciencia y tecnología",
    description: "Genética, sanidad animal e innovación en finca.",
    legacyPaths: ["/ciencia-y-tecnologia"],
    sortOrder: 5,
  },
  {
    slug: "opinion",
    name: "Opinión",
    description: "Columnas y análisis de la actualidad ganadera.",
    legacyPaths: ["/columna", "/columnistas", "/blogs"],
    sortOrder: 6,
  },
];

const ARTICLES: Array<{
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cat: string;
  author: string;
  tags: string[];
  daysAgo: number;
  cover: string | null;
  coverAlt?: string;
}> = [
  {
    slug: "precio-novillo-gordo-sube-4-por-ciento-en-medellin",
    title: "El precio del novillo gordo sube 4 % en Medellín durante septiembre",
    excerpt:
      "La Central Ganadera de Medellín reportó un alza sostenida en el precio del novillo gordo, impulsada por una menor oferta regional y mayor demanda de plantas de sacrificio.",
    body: "<p>El precio promedio del novillo gordo en la Central Ganadera de Medellín cerró la primera quincena de septiembre en 9.850 pesos por kilo en pie, un 4 % por encima del cierre de agosto.</p><h2>Qué explica el alza</h2><p>Comercializadores consultados atribuyen el movimiento a una menor entrada de animales desde el Magdalena Medio y a la reactivación de pedidos de plantas de sacrificio con destino a Bogotá.</p><h2>Perspectiva</h2><p>El gremio regional espera que los precios se estabilicen en octubre si mejora la oferta de ganado cebado del Bajo Cauca.</p>",
    cat: "economia-y-mercados",
    author: "redaccion",
    tags: ["precios", "novillo gordo", "Antioquia", "subasta"],
    daysAgo: 1,
    cover: "/fotos/precio-novillo-gordo-sube-4-por-ciento-en-medellin.jpg",
    coverAlt: "Novillos en pastoreo",
  },
  {
    slug: "lluvias-de-agosto-mejoran-praderas-en-los-llanos-orientales",
    title: "Las lluvias de agosto mejoraron el estado de las praderas en los Llanos Orientales",
    excerpt:
      "Tras un primer semestre marcado por la sequía, la temporada de lluvias recuperó la capacidad de carga en fincas de Meta y Casanare.",
    body: "<p>Ganaderos de Puerto López y Yopal reportan una recuperación notable de las praderas después de las lluvias de agosto, que pusieron fin a cuatro meses de déficit hídrico.</p><h2>Capacidad de carga</h2><p>En predios de sabana bien manejada, la capacidad de carga volvió a valores cercanos a una unidad de gran ganado por hectárea.</p><p>Los técnicos recomiendan aprovechar la ventana para diferir potreros y recuperar la condición corporal de las vacas de cría antes del próximo verano.</p>",
    cat: "regiones",
    author: "redaccion",
    tags: ["clima", "praderas", "Llanos", "Meta", "Casanare"],
    daysAgo: 3,
    cover: "/fotos/lluvias-de-agosto-mejoran-praderas-en-los-llanos-orientales.jpg",
    coverAlt: "Praderas verdes tras la temporada de lluvias",
  },
  {
    slug: "sistemas-silvopastoriles-ganan-terreno-en-el-caribe",
    title: "Los sistemas silvopastoriles ganan terreno entre ganaderos del Caribe",
    excerpt:
      "Un programa de asistencia técnica acompañó la conversión de 1.200 hectáreas a sistemas silvopastoriles en Córdoba y Sucre durante el último año.",
    body: "<p>El programa, financiado con cooperación internacional y recursos del gremio, cerró su primera fase con 1.200 hectáreas convertidas a sistemas silvopastoriles intensivos.</p><h2>Resultados</h2><p>Las fincas participantes reportan aumentos de entre 15 % y 30 % en la producción de leche por hectárea y una reducción del estrés calórico del hato.</p><h2>Siguiente fase</h2><p>La meta para el próximo año es sumar 2.000 hectáreas y capacitar a 400 productores adicionales.</p>",
    cat: "sostenibilidad",
    author: "maria-restrepo",
    tags: ["silvopastoril", "sostenibilidad", "Córdoba", "Sucre", "leche"],
    daysAgo: 5,
    cover: "/fotos/sistemas-silvopastoriles-ganan-terreno-en-el-caribe.jpg",
    coverAlt: "Ganado bajo árboles en un sistema silvopastoril",
  },
  {
    slug: "gobierno-y-gremios-negocian-nuevo-esquema-de-vacunacion",
    title: "Gobierno y gremios negocian un nuevo esquema para el ciclo de vacunación",
    excerpt:
      "Las partes discuten ajustes al calendario y a la tarifa del ciclo de vacunación contra fiebre aftosa y brucelosis para el próximo semestre.",
    body: "<p>Representantes del Ministerio de Agricultura, el ICA y los gremios ganaderos se reunieron esta semana para revisar el esquema operativo del próximo ciclo de vacunación.</p><h2>Puntos en discusión</h2><ul><li>Actualización de la tarifa por dosis aplicada.</li><li>Ampliación de la ventana de vacunación en zonas de difícil acceso.</li><li>Fortalecimiento de la trazabilidad digital de los registros.</li></ul><p>Se espera una decisión antes de que termine el mes.</p>",
    cat: "politica-gremial",
    author: "redaccion",
    tags: ["vacunación", "fiebre aftosa", "ICA", "brucelosis", "política"],
    daysAgo: 7,
    cover: "/fotos/gobierno-y-gremios-negocian-nuevo-esquema-de-vacunacion.jpg",
    coverAlt: "Vacunación de bovinos en finca",
  },
  {
    slug: "seleccion-genetica-por-eficiencia-alimenticia-en-el-tropico",
    title: "La selección genética por eficiencia alimenticia empieza a dar resultados en el trópico",
    excerpt:
      "Núcleos de selección en razas cebuínas reportan avances medibles en consumo residual de alimento sin sacrificar fertilidad.",
    body: "<p>Programas de mejoramiento en Brahman y Guzerá que incorporan el consumo residual de alimento como criterio de selección presentan sus primeros resultados tras cinco años de evaluación.</p><h2>Qué se midió</h2><p>Los animales más eficientes consumieron entre 8 % y 12 % menos alimento para la misma ganancia de peso, sin diferencias significativas en indicadores reproductivos.</p><p>Los técnicos advierten que la adopción a nivel comercial dependerá del acceso a pruebas de desempeño a costo razonable.</p>",
    cat: "ciencia-y-tecnologia",
    author: "maria-restrepo",
    tags: ["genética", "Brahman", "eficiencia alimenticia", "trópico"],
    daysAgo: 10,
    cover: "/fotos/seleccion-genetica-por-eficiencia-alimenticia-en-el-tropico.jpg",
    coverAlt: "Toro cebú de núcleo de selección",
  },
  {
    slug: "exportaciones-de-carne-bovina-crecen-en-el-tercer-trimestre",
    title: "Las exportaciones de carne bovina crecen en el tercer trimestre",
    excerpt:
      "El volumen exportado aumentó frente al mismo periodo del año anterior, con mayor participación de destinos del Medio Oriente.",
    body: "<p>Las exportaciones colombianas de carne bovina y despojos comestibles registraron un crecimiento interanual en el tercer trimestre, según cifras preliminares del sector.</p><h2>Destinos</h2><p>Se mantiene la concentración en mercados regionales, pero crecen los envíos a destinos del Medio Oriente y el norte de África.</p><h2>Retos</h2><p>El gremio insiste en la necesidad de nuevas admisibilidades sanitarias y en reducir los costos logísticos portuarios.</p>",
    cat: "economia-y-mercados",
    author: "redaccion",
    tags: ["exportaciones", "carne bovina", "comercio exterior"],
    daysAgo: 12,
    cover: "/fotos/exportaciones-de-carne-bovina-crecen-en-el-tercer-trimestre.jpg",
    coverAlt: "Carne bovina lista para despacho",
  },
  {
    slug: "el-reto-de-relevo-generacional-en-la-ganaderia-columna",
    title: "El reto del relevo generacional en la ganadería",
    excerpt:
      "Sin jóvenes dispuestos a quedarse en el campo, la mejor genética y la mejor pradera no sirven de nada. Una reflexión sobre lo que viene.",
    body: "<p>Recorriendo fincas en el último año, una pregunta se repite más que cualquier consulta sobre precios o sanidad: ¿quién va a manejar esto cuando yo no pueda?</p><p>El relevo generacional no se resuelve con un crédito ni con un taller. Requiere que la actividad sea rentable, que ofrezca calidad de vida y que el conocimiento se transmita de forma ordenada.</p><p>Hay experiencias que funcionan: empresas familiares que profesionalizan la administración, esquemas de aparcería con jóvenes técnicos, cooperativas que comparten maquinaria. Vale la pena mirarlas de cerca.</p>",
    cat: "opinion",
    author: "jorge-medina",
    tags: ["opinión", "relevo generacional", "campo"],
    daysAgo: 15,
    cover: "/fotos/el-reto-de-relevo-generacional-en-la-ganaderia-columna.jpg",
    coverAlt: "Ganadero joven en faenas de finca",
  },
  {
    slug: "pequenos-productores-de-leche-enfrentan-alza-en-costos-de-insumos",
    title: "Pequeños productores de leche enfrentan un alza en los costos de insumos",
    excerpt:
      "El precio de sales mineralizadas y fertilizantes presiona los márgenes de las fincas lecheras del altiplano cundiboyacense.",
    body: "<p>Productores de leche de Ubaté y Chiquinquirá reportan incrementos en el costo de sales mineralizadas, fertilizantes y concentrado que no alcanzan a compensarse con el precio pagado al productor.</p><h2>Margen ajustado</h2><p>En fincas de menos de 20 vacas, el margen operativo por litro se ha reducido de forma sostenida durante el año.</p><p>Las asociaciones piden revisar la fórmula de pago y fortalecer las compras conjuntas de insumos.</p>",
    cat: "economia-y-mercados",
    author: "redaccion",
    tags: ["leche", "costos", "insumos", "Cundinamarca", "Boyacá"],
    daysAgo: 18,
    cover: "/fotos/pequenos-productores-de-leche-enfrentan-alza-en-costos-de-insumos.jpg",
    coverAlt: "Ordeño en una finca lechera",
  },
];

const ARCHIVE: Array<{
  externalId: string;
  title: string;
  summary: string;
  legacyCategory: string;
  daysAgo: number;
}> = [
  {
    externalId: "legacy-30412",
    title: "Cómo interpretar el precio del ganado gordo en las principales centrales",
    summary:
      "Guía práctica de 2019 sobre la formación de precios del ganado gordo en Medellín, Bogotá y la Costa, y las diferencias entre precio en pie y en canal.",
    legacyCategory: "economia",
    daysAgo: 1900,
  },
  {
    externalId: "legacy-28877",
    title: "Manejo de praderas en época seca: diferir potreros y suplementar a tiempo",
    summary:
      "Recomendaciones técnicas para sostener la capacidad de carga durante el verano en sabanas de los Llanos y el Caribe seco.",
    legacyCategory: "regiones",
    daysAgo: 2100,
  },
  {
    externalId: "legacy-25510",
    title: "Fiebre aftosa: qué cambió en el ciclo de vacunación tras la pérdida del estatus",
    summary:
      "Cronología de las medidas sanitarias adoptadas por el ICA y los gremios y su efecto sobre el calendario de vacunación.",
    legacyCategory: "politica",
    daysAgo: 2500,
  },
  {
    externalId: "legacy-22030",
    title: "Sistemas silvopastoriles: resultados de diez años de investigación en el trópico bajo",
    summary:
      "Síntesis de los estudios sobre productividad, bienestar animal y captura de carbono en arreglos silvopastoriles con leucaena.",
    legacyCategory: "ganaderia-sostenible",
    daysAgo: 2800,
  },
  {
    externalId: "legacy-19004",
    title: "Exportación de carne bovina: la ruta de las admisibilidades sanitarias",
    summary:
      "Explicación de cómo se abre un mercado internacional para la carne colombiana y por qué el proceso toma años.",
    legacyCategory: "economia",
    daysAgo: 3200,
  },
];

export async function seed(db: AnyDb): Promise<{ created: boolean }> {
  const existing = await db.select({ id: schema.articles.id }).from(schema.articles).limit(1);
  if (existing.length > 0) return { created: false };

  // --- Usuarios ---
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "editor@contextoganadero.com").toLowerCase();
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? "contexto2026";
  const redactorEmail = "redactor@contextoganadero.com";

  // Ids fijos a propósito: la BD local se recrea en cada arranque y, con ids
  // aleatorios, la sesión guardada en el navegador apuntaba a un usuario que
  // ya no existía. Con ids estables la sesión sobrevive al reinicio.
  await db
    .insert(schema.users)
    .values([
      {
        id: "00000000-0000-4000-8000-000000000001",
        email: adminEmail,
        name: "Ana Gómez",
        role: "administrador",
        passwordHash: await bcrypt.hash(adminPass, 10),
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        email: redactorEmail,
        name: "Luis Parra",
        role: "redactor",
        passwordHash: await bcrypt.hash("contexto2026", 10),
      },
    ])
    .onConflictDoNothing();

  // --- Taxonomía ---
  await db.insert(schema.categories).values(CATS).onConflictDoNothing();

  // --- Autores ---
  await db
    .insert(schema.authors)
    .values([
      { slug: "redaccion", name: "Redacción CONtexto Ganadero", bio: "Equipo periodístico del medio." },
      {
        slug: "maria-restrepo",
        name: "María Restrepo",
        bio: "Periodista especializada en ciencia y producción animal.",
      },
      {
        slug: "jorge-medina",
        name: "Jorge Medina",
        bio: "Médico veterinario y columnista. Escribe sobre política sectorial.",
      },
    ])
    .onConflictDoNothing();

  const cats = await db.select().from(schema.categories);
  const authors = await db.select().from(schema.authors);
  const catId = (slug: string) => cats.find((c) => c.slug === slug)?.id ?? null;
  const authorId = (slug: string) => authors.find((a) => a.slug === slug)?.id ?? null;

  // --- Artículos ---
  const now = Date.now();
  await db.insert(schema.articles).values(
    ARTICLES.map((a) => ({
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      body: a.body,
      coverImageUrl: a.cover,
      coverImageAlt: a.coverAlt ?? null,
      categoryId: catId(a.cat),
      authorId: authorId(a.author),
      status: "publicado" as const,
      tags: a.tags,
      publishedAt: new Date(now - a.daysAgo * 86_400_000),
      updatedAt: new Date(now - a.daysAgo * 86_400_000),
    })),
  );

  // --- Espejo del archivo histórico (solo lectura) ---
  await db.insert(schema.archiveIndex).values(
    ARCHIVE.map((e) => ({
      externalId: e.externalId,
      canonicalUrl: `https://www.contextoganadero.com/nota/${e.externalId}`,
      title: e.title,
      summary: e.summary,
      legacyCategory: e.legacyCategory,
      publishedAt: new Date(now - e.daysAgo * 86_400_000),
      sourceHash: e.externalId,
    })),
  );

  // --- Redirecciones 301 de ejemplo ---
  await db
    .insert(schema.redirects)
    .values([
      { fromPath: "/economia/precio-del-ganado-hoy", toPath: "/categoria/economia-y-mercados" },
      {
        fromPath: "/nota/precio-novillo",
        toPath: "/articulo/precio-novillo-gordo-sube-4-por-ciento-en-medellin",
      },
    ])
    .onConflictDoNothing();

  // --- Zonas de avisos ---
  await db
    .insert(schema.adsZones)
    .values([
      { key: "home_top", name: "Home — banner superior" },
      { key: "article_sidebar", name: "Artículo — barra lateral" },
    ])
    .onConflictDoNothing();

  // --- Series de datos ---
  const [serie] = await db
    .insert(schema.dataSeries)
    .values({
      key: "precio_novillo_gordo_medellin",
      name: "Precio novillo gordo — Medellín",
      unit: "COP/kg",
      source: "Central Ganadera de Medellín",
    })
    .onConflictDoNothing()
    .returning({ id: schema.dataSeries.id });
  if (serie) {
    const base = 9200;
    await db.insert(schema.dataPoints).values(
      Array.from({ length: 12 }).map((_, i) => ({
        seriesId: serie.id,
        observedOn: new Date(now - (11 - i) * 7 * 86_400_000).toISOString().slice(0, 10),
        value: String(base + i * 60 + (i % 3) * 40),
      })),
    );
  }

  // --- Borrador de agente pendiente de aprobación (demo del flujo) ---
  await db.insert(schema.agentDrafts).values({
    source: "boletin_precios",
    sourceRef: "Boletín SIPSA — semana 36",
    sourcePayload: { plaza: "Medellín", categoria: "novillo gordo", precio: 9850, variacion: "+4%" },
    modelVersion: "claude-sonnet-5",
    title: "Novillo gordo en Medellín cerró la semana en 9.850 pesos por kilo",
    excerpt:
      "El boletín de precios reportó un alza semanal del 4 % en la plaza de Medellín para la categoría de novillo gordo.",
    body: "<p>Según el boletín de precios de la semana 36, el novillo gordo en Medellín se cotizó en 9.850 pesos por kilo en pie, con una variación semanal de {{+4 %}}.</p>",
    factChecks: [
      {
        claim: "Precio novillo gordo Medellín",
        value: "9.850 COP/kg",
        verified: true,
        sourceQuote: "Medellín — novillo gordo: 9.850",
        note: null,
      },
      {
        claim: "Variación semanal",
        value: "+4 %",
        verified: false,
        sourceQuote: null,
        note: "El boletín no incluye la variación; debe calcularse contra la semana previa.",
      },
    ],
    hasUnverifiedClaims: true,
    status: "pendiente",
  });

  // --- Log de consultas al asistente (para el tablero de demanda) ---
  const demoQueries: Array<[string, boolean, "generativo" | "semantico_degradado"]> = [
    ["¿cuánto está el precio del novillo gordo en Medellín?", true, "generativo"],
    ["cómo mejorar praderas en época seca", true, "generativo"],
    ["qué es un sistema silvopastoril", true, "generativo"],
    ["calendario de vacunación fiebre aftosa 2026", true, "generativo"],
    ["precio de la leche en Ubaté", true, "generativo"],
    ["subsidios para compra de ganado en Nariño", false, "generativo"],
    ["crédito Finagro para maquinaria", false, "generativo"],
    ["cómo curar un ternero con diarrea", false, "generativo"],
  ];
  await db.insert(schema.assistantQueries).values(
    demoQueries.map(([q, answered, mode], i) => ({
      sessionId: `demo-${i % 3}`,
      question: q,
      mode,
      citedSources: answered
        ? [{ title: "Artículo relacionado", url: "/articulo/" + ARTICLES[i % ARTICLES.length].slug, kind: "articulo" as const }]
        : [],
      answered,
      inputTokens: answered ? 1200 : 0,
      outputTokens: answered ? 320 : 0,
      costUsd: answered ? "0.008" : "0",
      createdAt: new Date(now - (i * 9 + 2) * 3_600_000),
    })),
  );

  return { created: true };
}
