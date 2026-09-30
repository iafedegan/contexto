/**
 * Modelo de datos único — CONtexto Ganadero
 * -----------------------------------------------------------------------------
 * Principio de arquitectura #3: un solo motor Postgres para contenido, usuarios,
 * avisos, series de datos y vectores de embeddings. Sin buscador externo.
 *
 * Dimensión de embeddings: 1536 (text-embedding-3-small). Si se cambia de modelo
 * hay que recrear las columnas `embedding` y sus índices HNSW.
 */
import { relations, sql } from "drizzle-orm";
import type { HomeTitleFont } from "@/lib/home-fonts";
import type { RegionStyles } from "@/lib/home-regions";
import type { TemplateParts } from "@/lib/template-parts";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Estilo manual de una tarjeta en /panel/portada. Todo opcional: lo que no se
 * fija usa el look por defecto de la sección donde caiga la nota.
 */
export type HomeStyle = {
  /** Tamaño del bloque: cuánto texto/imagen se muestra. */
  size?: "sm" | "md" | "lg";
  /** Columnas ocupadas en la cuadrícula "Lo más reciente" (1 o 2). */
  span?: 1 | 2;
  /** Familia del titular: ver `HOME_FONTS` en src/lib/home-fonts.ts. */
  font?: HomeTitleFont;
  bold?: boolean;
  italic?: boolean;
  /** Escala del titular en % sobre el tamaño de su sección (80-150). */
  titleScale?: number;
  /** Escala de la imagen en % (40-100): la encoge dentro de la tarjeta. */
  imageScale?: number;
  /** Color del titular (#rrggbb). Sin valor = el del tema de la plantilla. */
  color?: string;
};

// --- Enums -----------------------------------------------------------------

export const userRole = pgEnum("user_role", ["redactor", "editor", "administrador"]);

export const editorialStatus = pgEnum("editorial_status", [
  "borrador",
  "en_revision",
  "programado",
  "publicado",
  "archivado",
]);

export const draftStatus = pgEnum("draft_status", ["pendiente", "aprobado", "rechazado"]);

export const agentSource = pgEnum("agent_source", [
  "boletin_precios",
  "comunicado",
  "convocatoria",
  "agenda_ferias",
  "otro",
]);

export const assistantMode = pgEnum("assistant_mode", ["generativo", "semantico_degradado"]);

// --- Usuarios y autenticación (panel editorial) --------------------------

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"), // credenciales locales
  role: userRole("role").notNull().default("redactor"),
  // Segundo factor (TOTP)
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Passkeys (WebAuthn) — alternativa sin escribir nada al TOTP: el navegador
 * pide huella/Face ID/PIN del dispositivo en vez de un código de 6 dígitos.
 * Una cuenta puede tener varias (celular, laptop…). `credentialId` y
 * `publicKey` se guardan en base64url, tal como los codifica
 * `@simplewebauthn/server`; `counter` es la defensa contra reproducir una
 * misma respuesta capturada (debe subir en cada uso, nunca bajar).
 */
export const passkeys = pgTable("passkeys", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  deviceType: text("device_type").notNull(), // "singleDevice" | "multiDevice"
  backedUp: boolean("backed_up").notNull().default(false),
  transports: text("transports"), // JSON de AuthenticatorTransportFuture[], opcional
  label: text("label"), // "iPhone de Ana", lo pone la persona al crearla
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

// Tablas mínimas requeridas por @auth/drizzle-adapter (sesiones JWT no las usan,
// pero se dejan para permitir SSO futuro sin migración).
export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// --- Taxonomía y autores -------------------------------------------------

export const authors = pgTable("authors", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  // Vínculo opcional a una cuenta del panel (un autor puede no tener login).
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    parentId: uuid("parent_id"),
    // Rutas de la taxonomía legada que redirigen (301) a esta categoría.
    legacyPaths: jsonb("legacy_paths").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("categories_parent_idx").on(t.parentId)],
);

// --- Artículos propios --------------------------------------------------

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    // Resumen editorial: fuente de la meta description (nunca keyword stuffing).
    excerpt: text("excerpt").notNull(),
    body: text("body").notNull(), // markdown / HTML sanitizado
    coverImageUrl: text("cover_image_url"),
    coverImageAlt: text("cover_image_alt"),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    authorId: uuid("author_id").references(() => authors.id, { onDelete: "set null" }),
    status: editorialStatus("status").notNull().default("borrador"),
    // Metadatos SEO opcionales; si están vacíos se derivan de title/excerpt.
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    // Si el artículo nació de un borrador de agente, se conserva la trazabilidad.
    originDraftId: uuid("origin_draft_id"),
    // Embedding del título + excerpt + body (recorte) para búsqueda híbrida.
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    // Posición manual en la portada (0 = principal, 1 = secundaria, 2..5 =
    // "en breve", 6+ = río). null = no está fijado; se ordena por fecha.
    // La gestiona el editor desde /panel/portada (drag & drop).
    homePosition: integer("home_position"),
    // Estilo manual de la tarjeta (tamaño, tipografía, negrilla/cursiva,
    // escala de imagen…). null = todo por defecto. Ver tipo `HomeStyle`.
    homeStyle: jsonb("home_style").$type<HomeStyle>(),
    // Última hora (H-05): barra destacada en portada mientras esté activa.
    isBreaking: boolean("is_breaking").notNull().default(false),
    // Etiqueta "En Vivo" (AI-03 / FM-06): cubrimientos y transmisiones.
    isLive: boolean("is_live").notNull().default(false),
    // Contador de lecturas para "Más leídas" (H-04). Lo incrementa un beacon
    // del cliente, no el render: con ISR el render no equivale a una visita.
    views: integer("views").notNull().default(0),
  },
  (t) => [
    index("articles_status_published_idx").on(t.status, t.publishedAt),
    index("articles_category_idx").on(t.categoryId),
    index("articles_scheduled_idx").on(t.scheduledFor),
    index("articles_home_position_idx").on(t.homePosition),
    index("articles_views_idx").on(t.views),
    index("articles_breaking_idx").on(t.isBreaking),
    // Índice vectorial HNSW (coseno). Se crea en migración manual porque
    // drizzle-kit aún no emite `USING hnsw` de forma estable.
  ],
);

// Lecturas agregadas por artículo y día (analítica del panel). La alimenta el
// mismo beacon que `articles.views`; solo guarda un entero por día, nunca
// datos del visitante.
export const articleViewsDaily = pgTable(
  "article_views_daily",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    views: integer("views").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.day] }),
    index("article_views_daily_day_idx").on(t.day),
  ],
);

// Límite de intentos (login, formularios públicos). Una fila por clave
// ("login:ip:1.2.3.4", "contacto:ip:…"); se comparte entre instancias
// serverless, a diferencia de un contador en memoria.
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

// --- Espejo de solo lectura del archivo histórico ---------------------
// NUNCA se escribe de vuelta al sistema origen. Solo lo actualiza el job de
// sincronización (src/lib/archive-client.ts + inngest).

export const archiveIndex = pgTable(
  "archive_index",
  {
    // ID del artículo en el sistema legado.
    externalId: text("external_id").primaryKey(),
    canonicalUrl: text("canonical_url").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    legacyCategory: text("legacy_category"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // Hash del contenido origen para detectar cambios sin re-embeber todo.
    sourceHash: text("source_hash").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  },
  (t) => [index("archive_published_idx").on(t.publishedAt)],
);

// --- Avisos publicitarios --------------------------------------------

export const adsZones = pgTable("ads_zones", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(), // p.ej. "home_top", "article_sidebar"
  name: text("name").notNull(),
  // Creatividad activa (HTML/imagen + enlace). null = zona vacía.
  html: text("html"),
  imageUrl: text("image_url"),
  clickUrl: text("click_url"),
  active: boolean("active").notNull().default(false),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
});

// --- Newsletter -----------------------------------------------------

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  birthDate: date("birth_date"),
  mobile: text("mobile"),
  // Trazabilidad interna del alta (no se muestra al suscriptor): de dónde y
  // desde qué ciudad se registró, según la cabecera de geo-IP de Vercel.
  // Lat/lon vienen de la MISMA cabecera (x-vercel-ip-*): no se llama a ningún
  // servicio de geocodificación externo, así que solo hay dato para las altas
  // hechas después de este cambio.
  signupIp: text("signup_ip"),
  signupCity: text("signup_city"),
  /** Barrio que escribe el propio suscriptor: la IP solo da la ciudad. */
  neighborhood: text("neighborhood"),
  signupCountry: text("signup_country"),
  signupLat: numeric("signup_lat"),
  signupLon: numeric("signup_lon"),
  confirmed: boolean("confirmed").notNull().default(false),
  confirmToken: text("confirm_token"),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Series de datos (boletines de precios, indicadores) -------------
// Vive en el mismo motor: alimenta artículos automáticos y widgets.

export const dataSeries = pgTable("data_series", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(), // "precio_novillo_gordo_medellin"
  name: text("name").notNull(),
  unit: text("unit").notNull(), // "COP/kg"
  source: text("source").notNull(),
});

export const dataPoints = pgTable(
  "data_points",
  {
    seriesId: uuid("series_id")
      .notNull()
      .references(() => dataSeries.id, { onDelete: "cascade" }),
    observedOn: date("observed_on").notNull(),
    value: numeric("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.seriesId, t.observedOn] })],
);

// --- Borradores generados por agentes de IA -------------------------
// Principio #6: ningún borrador pasa a "publicado" sin acción explícita de un
// editor con rol habilitado.

export const agentDrafts = pgTable(
  "agent_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: agentSource("source").notNull(),
    // Referencia legible a la fuente concreta (URL del comunicado, id del boletín…).
    sourceRef: text("source_ref").notNull(),
    sourcePayload: jsonb("source_payload"), // datos estructurados de entrada
    modelVersion: text("model_version").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull(),
    body: text("body").notNull(),
    suggestedCategoryId: uuid("suggested_category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    // Resultado del agente verificador: cada cifra contrastada contra la fuente.
    factChecks: jsonb("fact_checks")
      .$type<
        Array<{
          claim: string;
          value: string;
          verified: boolean;
          sourceQuote: string | null;
          note: string | null;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    hasUnverifiedClaims: boolean("has_unverified_claims").notNull().default(false),
    status: draftStatus("status").notNull().default("pendiente"),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    // Artículo resultante tras la aprobación (atribuido al editor, no al sistema).
    publishedArticleId: uuid("published_article_id").references(() => articles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("agent_drafts_status_idx").on(t.status, t.createdAt)],
);

// --- Log de consultas al asistente ---------------------------------
// Alimenta el tablero de demanda informativa para la redacción.

export const assistantQueries = pgTable(
  "assistant_queries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: text("session_id").notNull(),
    question: text("question").notNull(),
    mode: assistantMode("mode").notNull(),
    // Fuentes recuperadas y citadas (obligatorio si mode = generativo).
    citedSources: jsonb("cited_sources")
      .$type<Array<{ title: string; url: string; kind: "articulo" | "archivo" }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    answered: boolean("answered").notNull().default(false), // false = declinó por falta de fuentes
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd").notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("assistant_queries_created_idx").on(t.createdAt),
    index("assistant_queries_session_idx").on(t.sessionId),
  ],
);

// --- Redirecciones 301 explícitas ---------------------------------
// Complementa el mapeo de `categories.legacyPaths`. Para casos uno-a-uno.

export const redirects = pgTable(
  "redirects",
  {
    fromPath: text("from_path").primaryKey(),
    toPath: text("to_path").notNull(),
    statusCode: integer("status_code").notNull().default(301),
    hits: integer("hits").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("redirects_from_idx").on(t.fromPath)],
);

// --- Boletín: ediciones ------------------------------------------------
// Cada edición del boletín (borrador o enviada). Los suscriptores viven en
// `newsletter_subscribers`; el envío es reanudable: `cursor` guarda el último
// suscriptor procesado, así una lista grande se envía por tandas sin repetir.
export const newsletterEditions = pgTable(
  "newsletter_editions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subject: text("subject").notNull(),
    // Texto que muestran los clientes de correo junto al asunto.
    preheader: text("preheader").notNull().default(""),
    // Saludo o nota del editor, antes de las noticias.
    intro: text("intro").notNull().default(""),
    // Notas incluidas, en orden; la primera es la destacada.
    articleSlugs: jsonb("article_slugs").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    // borrador | enviando | enviada
    status: text("status").notNull().default("borrador"),
    // Número de la edición, asignado al empezar el envío.
    issue: integer("issue"),
    cursor: text("cursor"),
    total: integer("total").notNull().default(0),
    delivered: integer("delivered").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("newsletter_editions_status_idx").on(t.status, t.createdAt)],
);

// --- API pública para terceros ------------------------------------------
// Claves de acceso a `/api/v1/*` (artículos, categorías, alta al boletín).
// Se guarda solo el hash (SHA-256): la clave en texto plano se muestra una
// única vez, al crearla, igual que un token de GitHub o Stripe — así un
// volcado de la base nunca la regala.
export const apiClients = pgTable(
  "api_clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    // Primeros caracteres de la clave, para reconocerla en la lista sin poder
    // reconstruirla (`cg_live_a1b2c3d4…`).
    keyPrefix: text("key_prefix").notNull(),
    active: boolean("active").notNull().default(true),
    requestsPerHour: integer("requests_per_hour").notNull().default(600),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("api_clients_active_idx").on(t.active)],
);

export type ApiClient = typeof apiClients.$inferSelect;

// --- Ajustes de sitio (clave/valor) --------------------------------
// Mecanismo genérico para configuración editable desde el panel que no es
// contenido (p. ej. el diseño de las secciones de portada). Una fila por
// clave; `value` es JSON libre e interpretado por quien lo lee.

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Fondo de la portada, elegido por un editor en /panel/portada. Se aplica a
 * TODA la plantilla (cabecera, contenido y pie), sobrescribiendo los tokens
 * de color del tema con variables CSS en línea.
 */
export type HomeBackground = {
  /** "theme" = el del tema de la plantilla; "solid" = un color; "gradient" = degradado. */
  mode: "theme" | "solid" | "gradient";
  /** Color sólido, o primer punto del degradado. */
  from?: string;
  /** Segundo punto del degradado. */
  to?: string;
  /** Ángulo del degradado en grados (0 = de abajo a arriba). */
  angle?: number;
};

/** Valor de site_settings con key = "home_layout": plantilla visual de la
 * portada + ajustes finos de sus secciones. */
export type HomeLayoutConfig = {
  /** Plantilla: decide componentes, efectos y tipografía (no solo columnas). */
  templateId?: "esmeralda" | "clasico" | "revista" | "compacto" | "vanguardia" | "gremial";
  /** "En breve" en la plantilla Clásico: lista vertical o fila horizontal. */
  breveDirection?: "vertical" | "horizontal";
  /** Columnas cuando "En breve" es horizontal (2-4). */
  breveColumns?: number;
  /** Columnas de la cuadrícula "Lo más reciente" en escritorio (2-4). */
  riverColumns?: number;
  /** Fondo de la plantilla (color sólido o degradado). */
  background?: HomeBackground;
  /** Estilo por componente: navbar, hero, cuerpo, tarjetas y pie. */
  regions?: RegionStyles;
  /** Plantilla compuesta: navbar, cuerpo y footer elegidos por separado. */
  parts?: TemplateParts;
};

// --- Relaciones ---------------------------------------------------

export const articlesRelations = relations(articles, ({ one }) => ({
  category: one(categories, { fields: [articles.categoryId], references: [categories.id] }),
  author: one(authors, { fields: [articles.authorId], references: [authors.id] }),
}));

export const agentDraftsRelations = relations(agentDrafts, ({ one }) => ({
  approver: one(users, { fields: [agentDrafts.approvedBy], references: [users.id] }),
  suggestedCategory: one(categories, {
    fields: [agentDrafts.suggestedCategoryId],
    references: [categories.id],
  }),
}));

// --- Tipos compartidos ------------------------------------------

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type ArchiveEntry = typeof archiveIndex.$inferSelect;
export type AgentDraft = typeof agentDrafts.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserRole = (typeof userRole.enumValues)[number];
export type EditorialStatus = (typeof editorialStatus.enumValues)[number];

/**
 * Mensajes de los formularios públicos (contacto y pauta comercial).
 * Se guardan en la base y se leen desde el panel: nada se envía a servicios de
 * terceros, y así el equipo conserva la trazabilidad de cada solicitud.
 */
export const contactKind = pgEnum("contact_kind", ["contacto", "comercial"]);

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: contactKind("kind").notNull().default("contacto"),
    name: text("name").notNull(),
    email: text("email").notNull(),
    organization: text("organization"),
    subject: text("subject"),
    message: text("message").notNull(),
    /** Marca de atención del panel: evita responder dos veces lo mismo. */
    handled: boolean("handled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contact_messages_created_idx").on(t.createdAt)],
);

/**
 * Suscripciones a notificaciones push (FM-01). Una fila por navegador; el
 * endpoint es único y es lo que el servidor usa para enviar el aviso.
 */
export const pushSubscriptions = pgTable("push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});
