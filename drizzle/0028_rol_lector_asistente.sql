-- Rol con el que corre el SQL que escribe la IA del asistente: solo puede leer las notas publicadas, las secciones y las cifras del Observatorio.
-- Es la barrera de la base: aunque una sentencia pasara `validarSelect`, no llega a `users`, a las claves ni a otros esquemas.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lector_asistente') THEN
    CREATE ROLE lector_asistente NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;--> statement-breakpoint
GRANT lector_asistente TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO lector_asistente;--> statement-breakpoint
GRANT SELECT (id, title, excerpt, published_at, cover_image_url, legacy_path, slug, category_id, status, search_vec) ON articles TO lector_asistente;--> statement-breakpoint
GRANT SELECT (id, name) ON categories TO lector_asistente;--> statement-breakpoint
GRANT SELECT (tema, indicador, titulo, unidad, fuente, serie, periodo, fecha, valor) ON observatorio_datos TO lector_asistente;--> statement-breakpoint
DROP POLICY IF EXISTS lector_asistente_notas ON articles;--> statement-breakpoint
CREATE POLICY lector_asistente_notas ON articles FOR SELECT TO lector_asistente USING (status = 'publicado');--> statement-breakpoint
DROP POLICY IF EXISTS lector_asistente_secciones ON categories;--> statement-breakpoint
CREATE POLICY lector_asistente_secciones ON categories FOR SELECT TO lector_asistente USING (true);--> statement-breakpoint
DROP POLICY IF EXISTS lector_asistente_cifras ON observatorio_datos;--> statement-breakpoint
CREATE POLICY lector_asistente_cifras ON observatorio_datos FOR SELECT TO lector_asistente USING (true);
