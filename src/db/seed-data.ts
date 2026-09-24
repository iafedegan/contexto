/**
 * Datos de arranque compartidos (PGlite local y Postgres gestionado).
 * Idempotente: usa onConflictDoNothing y comprueba si ya hay contenido.
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { db as DbType } from "./index";
import * as schema from "./schema";

type AnyDb = typeof DbType;

/**
 * Taxonomía calcada del navbar real de contextoganadero.com (verificada en el
 * sitio en vivo): 9 secciones de primer nivel, cada una con sus subcategorías
 * reales. `legacyPaths` guarda la ruta exacta del sitio legado para que
 * `LEGACY_TAXONOMY` (src/lib/redirects.ts) pueda 301-ear tráfico e indexación
 * acumulada hacia `/categoria/<slug>`.
 */
const PARENT_CATS = [
  { slug: "ganaderia", name: "Ganadería", description: "Producción, sanidad y manejo del hato.", sortOrder: 1 },
  {
    slug: "sistemas-pecuarios",
    name: "Sistemas pecuarios",
    description: "Porcicultura, avicultura y otras especies de producción.",
    sortOrder: 2,
  },
  { slug: "colombia", name: "Colombia", description: "Política, gremios y regiones del país.", sortOrder: 3 },
  {
    slug: "economia",
    name: "Economía",
    description: "Mercados, precios, agricultura y agroindustria.",
    sortOrder: 4,
  },
  { slug: "mundo", name: "Mundo", description: "Ganadería y agro en otros países.", sortOrder: 5 },
  {
    slug: "tendencias",
    name: "Tendencias",
    description: "Medioambiente, innovación y vida rural.",
    sortOrder: 6,
  },
  { slug: "opinion", name: "Opinión", description: "Columnas, editoriales y columnistas.", sortOrder: 7 },
  { slug: "agenda", name: "Agenda", description: "Congresos, ferias y eventos del sector.", sortOrder: 8 },
  {
    slug: "especiales",
    name: "Especiales",
    description: "Crónicas, reportajes e informes en profundidad.",
    sortOrder: 9,
  },
  // Secciones que el anexo funcional exige como mínimo (§2.1) y que la
  // taxonomía actual del sitio no contempla. Se añaden al final: la barra
  // principal muestra las ocho primeras (N-04) y el resto vive en «Más».
  {
    slug: "entrevistas",
    name: "Entrevistas",
    description: "Conversaciones con líderes, expertos, productores y autoridades.",
    sortOrder: 10,
  },
  {
    slug: "analisis",
    name: "Análisis",
    description: "Contexto sectorial, interpretación de cifras y coyuntura.",
    sortOrder: 11,
  },
  {
    slug: "servicios",
    name: "Servicios",
    description: "Recursos, herramientas e información útil para el productor.",
    sortOrder: 12,
  },
  { slug: "tv", name: "TV", description: "Programas, entrevistas en vídeo y material audiovisual.", sortOrder: 13 },
  { slug: "radio", name: "Radio", description: "Emisora, transmisiones y pódcast del sector.", sortOrder: 14 },
];

type ParentSlug = (typeof PARENT_CATS)[number]["slug"];

const CHILD_CATS: Array<{
  slug: string;
  name: string;
  description: string;
  legacyPaths: string[];
  sortOrder: number;
  parent: ParentSlug;
}> = [
  // --- Ganadería ---
  { slug: "sostenible", name: "Sostenible", description: "Ganadería sostenible, clima y ambiente.", legacyPaths: ["/sostenible"], sortOrder: 1, parent: "ganaderia" },
  { slug: "produccion", name: "Producción", description: "Manejo productivo y costos de finca.", legacyPaths: ["/produccion"], sortOrder: 2, parent: "ganaderia" },
  { slug: "sistemas-silvopastoriles", name: "Sistema Silvopastoril", description: "Arreglos silvopastoriles y agroforestería.", legacyPaths: ["/sistemas-silvopastoriles"], sortOrder: 3, parent: "ganaderia" },
  { slug: "nutricion", name: "Nutrición", description: "Alimentación y suplementación del hato.", legacyPaths: ["/nutricion"], sortOrder: 4, parent: "ganaderia" },
  { slug: "salud-animal", name: "Salud Animal", description: "Sanidad, vacunación y enfermedades.", legacyPaths: ["/saludanimal"], sortOrder: 5, parent: "ganaderia" },
  { slug: "razas", name: "Razas", description: "Genética y selección de razas bovinas.", legacyPaths: ["/razas"], sortOrder: 6, parent: "ganaderia" },

  // --- Sistemas pecuarios ---
  { slug: "porcicola", name: "Porcícola", description: "Producción porcina.", legacyPaths: ["/porcicola"], sortOrder: 1, parent: "sistemas-pecuarios" },
  { slug: "equino", name: "Equino", description: "Cría y manejo equino.", legacyPaths: ["/equino"], sortOrder: 2, parent: "sistemas-pecuarios" },
  { slug: "avicola", name: "Avícola", description: "Producción avícola.", legacyPaths: ["/avicola"], sortOrder: 3, parent: "sistemas-pecuarios" },
  { slug: "ovino-caprino", name: "Ovino-Caprino", description: "Producción ovina y caprina.", legacyPaths: ["/ovinocaprino"], sortOrder: 4, parent: "sistemas-pecuarios" },
  { slug: "otros-sistemas-pecuarios", name: "Otros", description: "Otras especies de producción pecuaria.", legacyPaths: ["/otrossistemP"], sortOrder: 5, parent: "sistemas-pecuarios" },

  // --- Colombia ---
  { slug: "politica", name: "Política", description: "Gobierno y normativa que afecta al productor.", legacyPaths: ["/politica"], sortOrder: 1, parent: "colombia" },
  { slug: "gremialidad", name: "Gremialidad", description: "Fedegán y los gremios del sector.", legacyPaths: ["/gremialidad"], sortOrder: 2, parent: "colombia" },
  { slug: "regiones", name: "Regiones", description: "Noticias de las zonas ganaderas del país.", legacyPaths: ["/regiones", "/RegionesView/ultNo"], sortOrder: 3, parent: "colombia" },

  // --- Economía ---
  { slug: "nacional", name: "Nacional", description: "Economía y mercados a nivel nacional.", legacyPaths: ["/nacional"], sortOrder: 1, parent: "economia" },
  { slug: "internacional", name: "Internacional", description: "Comercio exterior y mercados internacionales.", legacyPaths: ["/internacional"], sortOrder: 2, parent: "economia" },
  { slug: "precio-del-ganado", name: "Precio del Ganado", description: "Indicadores y precios del ganado en pie.", legacyPaths: ["/IndicadoresView/IndicadorGanadero"], sortOrder: 3, parent: "economia" },
  { slug: "agricultura", name: "Agricultura", description: "Cultivos e insumos agrícolas.", legacyPaths: ["/agricultura"], sortOrder: 4, parent: "economia" },
  { slug: "agroindustria", name: "Agroindustria", description: "Procesamiento, exportación y cadena de valor.", legacyPaths: ["/agroindustria"], sortOrder: 5, parent: "economia" },

  // --- Mundo ---
  { slug: "argentina", name: "Argentina", description: "Ganadería y agro en Argentina.", legacyPaths: ["/argentina"], sortOrder: 1, parent: "mundo" },
  { slug: "eeuu", name: "EE.UU.", description: "Ganadería y agro en Estados Unidos.", legacyPaths: ["/eeuu"], sortOrder: 2, parent: "mundo" },
  { slug: "espana", name: "España", description: "Ganadería y agro en España.", legacyPaths: ["/espana"], sortOrder: 3, parent: "mundo" },
  { slug: "mexico", name: "México", description: "Ganadería y agro en México.", legacyPaths: ["/mexico"], sortOrder: 4, parent: "mundo" },
  { slug: "peru", name: "Perú", description: "Ganadería y agro en Perú.", legacyPaths: ["/peru"], sortOrder: 5, parent: "mundo" },
  { slug: "otros-mundo", name: "Otros", description: "Otros países y mercados internacionales.", legacyPaths: ["/otrosmundo"], sortOrder: 6, parent: "mundo" },

  // --- Tendencias ---
  { slug: "medioambiente", name: "Medioambiente", description: "Clima, agua y biodiversidad.", legacyPaths: ["/medioambiente"], sortOrder: 1, parent: "tendencias" },
  { slug: "gastronomia", name: "Gastronomía", description: "Carne, lácteos y cocina rural.", legacyPaths: ["/gastronomia"], sortOrder: 2, parent: "tendencias" },
  { slug: "innovacion", name: "Innovación", description: "Tecnología aplicada al campo.", legacyPaths: ["/innovacion"], sortOrder: 3, parent: "tendencias" },
  { slug: "mascotas", name: "Mascotas", description: "Animales de compañía en la vida rural.", legacyPaths: ["/mascotas"], sortOrder: 4, parent: "tendencias" },
  { slug: "redes-sociales", name: "Redes Sociales", description: "Tendencias digitales del sector.", legacyPaths: ["/redessociales"], sortOrder: 5, parent: "tendencias" },

  // --- Opinión ---
  { slug: "columnas", name: "Columnas", description: "Columnas y análisis de la actualidad ganadera.", legacyPaths: ["/columna", "/columnas"], sortOrder: 1, parent: "opinion" },
  { slug: "editorial", name: "Editorial", description: "La posición editorial del medio.", legacyPaths: ["/editorial"], sortOrder: 2, parent: "opinion" },
  { slug: "blogs", name: "Blogs", description: "Blogs de colaboradores del medio.", legacyPaths: ["/blogs", "/BlogsView/SeeMore/ultNo"], sortOrder: 3, parent: "opinion" },
  { slug: "columnistas", name: "Columnistas", description: "Perfiles de los columnistas del medio.", legacyPaths: ["/columnistas", "/ColumnistasView/1"], sortOrder: 4, parent: "opinion" },

  // --- Agenda ---
  { slug: "congresos", name: "Congresos", description: "Congresos y encuentros del sector.", legacyPaths: ["/congresos"], sortOrder: 1, parent: "agenda" },
  { slug: "ferias", name: "Ferias", description: "Ferias ganaderas y agropecuarias.", legacyPaths: ["/ferias"], sortOrder: 2, parent: "agenda" },
  { slug: "tauromaquia", name: "Tauromaquia", description: "Eventos taurinos.", legacyPaths: ["/tauromaquia"], sortOrder: 3, parent: "agenda" },
  { slug: "otros-eventos", name: "Otros eventos", description: "Otros eventos del sector agropecuario.", legacyPaths: ["/otroseventos"], sortOrder: 4, parent: "agenda" },

  // --- Especiales ---
  { slug: "cronica", name: "Crónica", description: "Crónicas del campo colombiano.", legacyPaths: ["/cronica"], sortOrder: 1, parent: "especiales" },
  { slug: "reportaje", name: "Reportaje", description: "Reportajes en profundidad.", legacyPaths: ["/reportaje"], sortOrder: 2, parent: "especiales" },
  { slug: "entrevistas", name: "Entrevistas", description: "Entrevistas a protagonistas del sector.", legacyPaths: ["/entrevistas"], sortOrder: 3, parent: "especiales" },
  { slug: "informes", name: "Informes", description: "Informes y análisis extensos.", legacyPaths: ["/informes"], sortOrder: 4, parent: "especiales" },
  { slug: "gobierno-petro", name: "Gobierno Petro", description: "Seguimiento a la política agropecuaria del gobierno.", legacyPaths: ["/gobierno-petro"], sortOrder: 5, parent: "especiales" },
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
    cat: "precio-del-ganado",
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
    cat: "sistemas-silvopastoriles",
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
    cat: "politica",
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
    cat: "razas",
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
    cat: "agroindustria",
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
    cat: "columnas",
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
    cat: "produccion",
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

  // --- Taxonomía (padres primero, luego hijas con parentId) ---
  await db.insert(schema.categories).values(PARENT_CATS).onConflictDoNothing();
  const parents = await db.select().from(schema.categories);
  const parentId = (slug: string) => parents.find((c) => c.slug === slug)?.id ?? null;
  await db
    .insert(schema.categories)
    .values(
      CHILD_CATS.map(({ parent, ...c }) => ({
        ...c,
        parentId: parentId(parent),
      })),
    )
    .onConflictDoNothing();

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

  // --- Lecturas de ejemplo (analítica del panel) ---
  // Serie determinista: cada artículo arranca fuerte el día que se publica y
  // decae, con algo de ruido. Así la demo local tiene tendencias creíbles.
  // Solo en la BD embebida: en Postgres gestionado las cifras deben ser reales.
  const isEmbedded = !process.env.DATABASE_URL && !process.env.DATABASE_URL_POOLED;
  const inserted = await db
    .select({ id: schema.articles.id, publishedAt: schema.articles.publishedAt })
    .from(schema.articles);
  const dayMs = 86_400_000;
  const dailyRows: { articleId: string; day: string; views: number }[] = [];
  inserted.forEach((a, i) => {
    if (!isEmbedded || !a.publishedAt) return;
    const peak = 180 + ((i * 97) % 420);
    for (let d = 0; d < 30; d++) {
      const dayTs = now - d * dayMs;
      const age = Math.floor((dayTs - a.publishedAt.getTime()) / dayMs);
      if (age < 0) continue;
      const noise = 0.75 + (((i + 3) * (d + 7) * 31) % 50) / 100;
      const views = Math.round((peak / (1 + age * 0.45)) * noise);
      if (views > 0) {
        dailyRows.push({ articleId: a.id, day: new Date(dayTs).toISOString().slice(0, 10), views });
      }
    }
  });
  if (dailyRows.length > 0) {
    await db.insert(schema.articleViewsDaily).values(dailyRows);
    for (const a of inserted) {
      const total = dailyRows.filter((r) => r.articleId === a.id).reduce((s, r) => s + r.views, 0);
      await db.update(schema.articles).set({ views: total }).where(eq(schema.articles.id, a.id));
    }
  }

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
      { fromPath: "/economia/precio-del-ganado-hoy", toPath: "/categoria/precio-del-ganado" },
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
      { key: "home_top", name: "Portada — leaderboard superior (728×90)" },
      { key: "home_billboard", name: "Portada — billboard bajo el hero (970×250)" },
      { key: "home_grid", name: "Portada — rectángulo en la grilla (300×250)" },
      { key: "sidebar_top", name: "Barra lateral — superior (300×250)" },
      { key: "sidebar_sticky", name: "Barra lateral — media página fija (300×600)" },
      { key: "article_sidebar", name: "Artículo — rectángulo (300×250)" },
      { key: "footer", name: "Pie — leaderboard (728×90)" },
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
