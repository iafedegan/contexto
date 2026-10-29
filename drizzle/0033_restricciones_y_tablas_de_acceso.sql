-- Restricciones CHECK en las tablas críticas, tablas propias para los accesos y los permisos por persona (antes JSON suelto en
-- `site_settings`) y quita el índice duplicado de `redirects`. Evaluación de la base, 29/10/2026.
-- Idempotente (en producción se pega a mano en el SQL Editor de Supabase). Aplicar justo antes de desplegar el código que la usa:
-- hasta entonces la aplicación vieja sigue leyendo las claves de `site_settings`, que esta migración COPIA y no borra
-- (la limpieza va aparte, en docs/sql-limpieza-post-aceptacion.sql, cuando el código nuevo ya esté en producción).
-- Las tablas nuevas nacen con RLS activo (igual que las otras 30: la API pública de Supabase no debe verlas).
-- Las restricciones se crean NOT VALID y se validan después: así no bloquean las escrituras mientras revisan las 51 mil notas.

CREATE TABLE IF NOT EXISTS "login_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"metodo" text NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"dispositivo" text DEFAULT '' NOT NULL,
	CONSTRAINT "login_events_metodo" CHECK ("login_events"."metodo" in ('contraseña', 'passkey'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_2fa_grace" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_permission_overrides" (
	"user_id" uuid NOT NULL,
	"permiso" text NOT NULL,
	"valor" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_permission_overrides_user_id_permiso_pk" PRIMARY KEY("user_id","permiso")
);
--> statement-breakpoint
ALTER TABLE "login_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_2fa_grace" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_permission_overrides" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP INDEX IF EXISTS "redirects_from_idx";
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'login_events_user_id_users_id_fk') THEN
    ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_2fa_grace_user_id_users_id_fk') THEN
    ALTER TABLE "user_2fa_grace" ADD CONSTRAINT "user_2fa_grace_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_permission_overrides_user_id_users_id_fk') THEN
    ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_events_at_idx" ON "login_events" USING btree ("at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_events_user_idx" ON "login_events" USING btree ("user_id");
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_clients_limite_positivo') THEN
    ALTER TABLE "api_clients" ADD CONSTRAINT "api_clients_limite_positivo" CHECK ("api_clients"."requests_per_hour" > 0) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'article_views_daily_no_negativas') THEN
    ALTER TABLE "article_views_daily" ADD CONSTRAINT "article_views_daily_no_negativas" CHECK ("article_views_daily"."views" >= 0) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'articles_views_no_negativas') THEN
    ALTER TABLE "articles" ADD CONSTRAINT "articles_views_no_negativas" CHECK ("articles"."views" >= 0) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'articles_slug_formato') THEN
    ALTER TABLE "articles" ADD CONSTRAINT "articles_slug_formato" CHECK ("articles"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$') NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'articles_titulo_no_vacio') THEN
    ALTER TABLE "articles" ADD CONSTRAINT "articles_titulo_no_vacio" CHECK (btrim("articles"."title") <> '') NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'articles_publicada_con_fecha') THEN
    ALTER TABLE "articles" ADD CONSTRAINT "articles_publicada_con_fecha" CHECK ("articles"."status" <> 'publicado' or "articles"."published_at" is not null) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'articles_posicion_portada') THEN
    ALTER TABLE "articles" ADD CONSTRAINT "articles_posicion_portada" CHECK ("articles"."home_position" is null or "articles"."home_position" >= 0) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'editorial_slots_aprobacion') THEN
    ALTER TABLE "editorial_slots" ADD CONSTRAINT "editorial_slots_aprobacion" CHECK ("editorial_slots"."approval" in ('manual', 'auto')) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'editorial_slots_estado') THEN
    ALTER TABLE "editorial_slots" ADD CONSTRAINT "editorial_slots_estado" CHECK ("editorial_slots"."status" in ('planificada', 'redactando', 'revision', 'programada', 'publicada', 'fallida', 'omitida')) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'editorial_slots_prioridad') THEN
    ALTER TABLE "editorial_slots" ADD CONSTRAINT "editorial_slots_prioridad" CHECK ("editorial_slots"."priority" >= 0) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'newsletter_editions_estado') THEN
    ALTER TABLE "newsletter_editions" ADD CONSTRAINT "newsletter_editions_estado" CHECK ("newsletter_editions"."status" in ('borrador', 'programada', 'enviando', 'enviada')) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'newsletter_editions_cuentas') THEN
    ALTER TABLE "newsletter_editions" ADD CONSTRAINT "newsletter_editions_cuentas" CHECK ("newsletter_editions"."total" >= 0 and "newsletter_editions"."delivered" >= 0 and "newsletter_editions"."failed" >= 0) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'redirects_codigo') THEN
    ALTER TABLE "redirects" ADD CONSTRAINT "redirects_codigo" CHECK ("redirects"."status_code" in (301, 302, 307, 308)) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'redirects_sin_bucle') THEN
    ALTER TABLE "redirects" ADD CONSTRAINT "redirects_sin_bucle" CHECK ("redirects"."from_path" <> "redirects"."to_path") NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'redirects_origen_absoluto') THEN
    ALTER TABLE "redirects" ADD CONSTRAINT "redirects_origen_absoluto" CHECK ("redirects"."from_path" like '/%') NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_minusculas') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_email_minusculas" CHECK ("users"."email" = lower("users"."email")) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "api_clients" VALIDATE CONSTRAINT "api_clients_limite_positivo";
--> statement-breakpoint
ALTER TABLE "article_views_daily" VALIDATE CONSTRAINT "article_views_daily_no_negativas";
--> statement-breakpoint
ALTER TABLE "articles" VALIDATE CONSTRAINT "articles_views_no_negativas";
--> statement-breakpoint
ALTER TABLE "articles" VALIDATE CONSTRAINT "articles_slug_formato";
--> statement-breakpoint
ALTER TABLE "articles" VALIDATE CONSTRAINT "articles_titulo_no_vacio";
--> statement-breakpoint
ALTER TABLE "articles" VALIDATE CONSTRAINT "articles_publicada_con_fecha";
--> statement-breakpoint
ALTER TABLE "articles" VALIDATE CONSTRAINT "articles_posicion_portada";
--> statement-breakpoint
ALTER TABLE "editorial_slots" VALIDATE CONSTRAINT "editorial_slots_aprobacion";
--> statement-breakpoint
ALTER TABLE "editorial_slots" VALIDATE CONSTRAINT "editorial_slots_estado";
--> statement-breakpoint
ALTER TABLE "editorial_slots" VALIDATE CONSTRAINT "editorial_slots_prioridad";
--> statement-breakpoint
ALTER TABLE "newsletter_editions" VALIDATE CONSTRAINT "newsletter_editions_estado";
--> statement-breakpoint
ALTER TABLE "newsletter_editions" VALIDATE CONSTRAINT "newsletter_editions_cuentas";
--> statement-breakpoint
ALTER TABLE "redirects" VALIDATE CONSTRAINT "redirects_codigo";
--> statement-breakpoint
ALTER TABLE "redirects" VALIDATE CONSTRAINT "redirects_sin_bucle";
--> statement-breakpoint
ALTER TABLE "redirects" VALIDATE CONSTRAINT "redirects_origen_absoluto";
--> statement-breakpoint
ALTER TABLE "users" VALIDATE CONSTRAINT "users_email_minusculas";
--> statement-breakpoint
-- Copia de lo que hoy vive en `site_settings` (solo si las tablas nuevas están vacías, para poder repetir la migración sin duplicar).
INSERT INTO "user_permission_overrides" ("user_id", "permiso", "valor")
SELECT u.id, p.key, (p.value)::boolean
FROM site_settings s
CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(s.value) = 'object' THEN s.value ELSE '{}'::jsonb END) e
CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(e.value) = 'object' THEN e.value ELSE '{}'::jsonb END) p
JOIN users u ON u.id::text = e.key
WHERE s.key = 'user_permissions' AND jsonb_typeof(p.value) = 'boolean'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "user_2fa_grace" ("user_id", "until")
SELECT u.id, (e.value #>> '{}')::timestamptz
FROM site_settings s
CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(s.value) = 'object' THEN s.value ELSE '{}'::jsonb END) e
JOIN users u ON u.id::text = e.key
WHERE s.key = 'plazo_2fa' AND jsonb_typeof(e.value) = 'string'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "login_events" ("at", "user_id", "name", "email", "role", "metodo", "ip", "dispositivo")
SELECT (e->>'at')::timestamptz, u.id, coalesce(e->>'name', ''), coalesce(e->>'email', ''), coalesce(e->>'role', ''),
  CASE WHEN e->>'metodo' = 'passkey' THEN 'passkey' ELSE 'contraseña' END, coalesce(e->>'ip', ''), coalesce(e->>'dispositivo', '')
FROM site_settings s
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.value) = 'array' THEN s.value ELSE '[]'::jsonb END) e
LEFT JOIN users u ON u.id::text = e->>'userId'
WHERE s.key = 'login_log' AND (e->>'at')::timestamptz > now() - interval '90 days'
  AND NOT EXISTS (SELECT 1 FROM login_events);
