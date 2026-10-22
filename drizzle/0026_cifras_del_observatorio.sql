-- Cifras del Observatorio en formato largo (una fila por tema, indicador, serie y periodo). Idempotente: en producción se aplica a mano en el SQL Editor de Supabase.
CREATE TABLE IF NOT EXISTS "observatorio_datos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tema" text NOT NULL,
	"indicador" text NOT NULL,
	"titulo" text NOT NULL,
	"unidad" text DEFAULT '' NOT NULL,
	"fuente" text DEFAULT '' NOT NULL,
	"serie" text NOT NULL,
	"periodo" text NOT NULL,
	"fecha" date,
	"valor" double precision NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "observatorio_datos_unico" UNIQUE("tema","indicador","serie","periodo")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "observatorio_datos_consulta_idx" ON "observatorio_datos" USING btree ("tema","indicador","fecha");--> statement-breakpoint
-- Sin acceso por la API pública de Supabase: solo el servidor de la aplicación lee y escribe aquí.
ALTER TABLE "observatorio_datos" ENABLE ROW LEVEL SECURITY;
