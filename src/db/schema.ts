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
  },
  (t) => [
    index("articles_status_published_idx").on(t.status, t.publishedAt),
    index("articles_category_idx").on(t.categoryId),
    index("articles_scheduled_idx").on(t.scheduledFor),
    // Índice vectorial HNSW (coseno). Se crea en migración manual porque
    // drizzle-kit aún no emite `USING hnsw` de forma estable.
  ],
);

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
