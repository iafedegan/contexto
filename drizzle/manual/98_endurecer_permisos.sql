-- Endurecimiento de permisos de la base (evaluación de seguridad, 29/10/2026). Idempotente: se puede ejecutar más de una vez.
-- En producción se aplica a mano en el SQL Editor de Supabase (ver AGENTS.md).
--
-- Por qué: Supabase concede por defecto a los roles `anon` y `authenticated` (los de su API REST pública) todos los permisos
-- sobre las tablas del esquema `public` (SELECT, INSERT, UPDATE, DELETE, TRUNCATE…). Hoy los protege solo RLS (activo en las
-- 30 tablas, sin políticas: la API pública devuelve vacío). Quitar los permisos añade una segunda capa: si alguien desactivara
-- RLS por error en una tabla, seguiría sin poder leerse ni escribirse desde fuera.
--
-- Seguro para la aplicación: el portal se conecta con `pg` como `postgres` (DATABASE_URL) y no usa la API REST ni
-- `@supabase/supabase-js`; el almacenamiento de imágenes usa la clave `service_role`, que no se toca aquí.
--
-- Para deshacerlo: GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated; (no se recomienda).

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Las tablas que se creen más adelante tampoco heredan esos permisos.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Alerta «function_search_path_mutable» del asesor de Supabase: las dos funciones de las zonas fijan su ruta de búsqueda.
ALTER FUNCTION public.articles_zonas_de(text) SET search_path = pg_catalog, public;
ALTER FUNCTION public.articles_zonas_trg() SET search_path = pg_catalog, public;
