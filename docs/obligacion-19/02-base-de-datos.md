---
codigo: CG-DOC-02
titulo: Documentación de la base de datos
subtitulo: Motor, topología, modelo de datos, diccionario de datos, integridad, índices, migraciones, retención y verificación
version: 1.0
audiencia: Auditores, administradores de datos y contraparte técnica de FEDEGÁN
fuente: Esquema del repositorio (src/db/schema.ts, drizzle/) y consultas de solo lectura a la base de producción, ejecutadas el 19 de octubre de 2026
---

# 1. Propósito y alcance

Documenta la base de datos de CONtexto Ganadero con el detalle necesario para **auditar el modelo, verificar la integridad de los datos y reconstruir el entorno**. Combina dos fuentes que se contrastan entre sí: el **esquema declarado en el código** (`src/db/schema.ts`, del que se genera el diccionario del Anexo A con `npm run docs:bd`) y el **estado real de producción** consultado el 19/10/2026 con consultas de solo lectura.

# 2. Motor y topología

| Elemento | Valor |
|---|---|
| Motor | PostgreSQL **17.11** (x86_64) |
| Servicio gestionado | Supabase, proyecto `CONTEXTOPRO` (identificador `cguzwzffmzxubfruulem`), región AWS us-east-2 |
| Base de datos | `postgres`, tamaño total **697 MB** |
| Esquema de aplicación | `public` (26 tablas de la aplicación) |
| Conexión desde la aplicación | Controlador `postgres` 3.4 por la cadena `DATABASE_URL_POOLED` (pooler de transacciones, apto para funciones sin servidor) y `DATABASE_URL` (directa) |
| Acceso para desarrollo y pruebas | PGlite (PostgreSQL embebido) en local y en memoria en las pruebas automáticas; **no** se usa en producción |
| Almacenamiento de objetos | Supabase Storage, bucket `media` (público de lectura); lo escribe la aplicación con la clave de servicio |

**Extensiones instaladas** (`pg_extension`): `vector` 0.8.2 (vectores para búsqueda semántica), `pg_trgm` 1.6 (búsqueda difusa por título), `pgcrypto` 1.3, `uuid-ossp` 1.1, `plpgsql` 1.0, `pg_stat_statements` 1.11 (diagnóstico de consultas) y `supabase_vault` 0.3.1.

# 3. Inventario de tablas y volumen (producción, 19/10/2026)

El «módulo dueño» sale del mapa de arquitectura (CG-DOC-01): cada tabla pertenece a un solo módulo.

| Tabla | Módulo dueño | Filas aprox. | Tamaño | Índices | RLS |
|---|---|---:|---:|---:|:--:|
| `articles` | contenido | 51.382 | 605 MB | 20 | Sí |
| `redirects` | contenido | 284 | 23 MB | 2 | Sí |
| `site_settings` | portada-tema | 22 | 344 kB | 1 | Sí |
| `editorial_slots` | ia (consejo de redacción) | 5 | 176 kB | 3 | Sí |
| `reader_sessions` | analitica | 45 | 112 kB | 4 | Sí |
| `assistant_queries` | ia | — | 96 kB | 3 | Sí |
| `api_clients` | acceso | 1 | 96 kB | 3 | Sí |
| `categories` | contenido | 56 | 96 kB | 3 | Sí |
| `editorial_plans` | ia (consejo de redacción) | 1 | 88 kB | 1 | Sí |
| `authors` | contenido | 68 | 88 kB | 2 | Sí |
| `rate_limits` | infra | 14 | 64 kB | 1 | Sí |
| `passkeys` | acceso | — | 64 kB | 3 | Sí |
| `newsletter_editions` | newsletter | 0 | 64 kB | 2 | Sí |
| `archive_index` | archivo (sin uso desde la migración) | — | 56 kB | 4 | Sí |
| `ads_zones` | portada-tema | — | 48 kB | 2 | Sí |
| `data_series`, `data_points` | analitica | — | 48 + 32 kB | 2 + 1 | Sí |
| `users` | acceso | — | 48 kB | 2 | Sí |
| `agent_drafts` | ia | — | 48 kB | 2 | Sí |
| `newsletter_subscribers` | newsletter | — | 48 kB | 2 | Sí |
| `article_views_daily` | analitica | 36 | 40 kB | 2 | Sí |
| `subscriber_visitors` | analitica | — | 40 kB | 2 | Sí |
| `push_subscriptions` | canales | — | 32 kB | 1 | Sí |
| `contact_messages` | contenido | — | 24 kB | 2 | Sí |
| `verification_tokens`, `sessions` | acceso | — | 16 + 16 kB | 1 + 1 | Sí |
| `articles_meta_title_respaldo` | — (respaldo operativo del 19/10/2026) | 7.391 | 896 kB | 0 | Sí |

«—» indica que el motor aún no tiene estadísticas de filas (tabla pequeña o sin análisis reciente), no que esté vacía. Los volúmenes exactos se obtienen con las consultas de la sección 11.

**Lectura del inventario.** Casi todo el peso está en `articles` (≈ 87 % de la base) por el cuerpo de las 51 mil notas y sus 20 índices. **Todas las tablas tienen seguridad a nivel de fila (RLS) habilitada**; la aplicación se conecta con un rol de servicio, de modo que las políticas protegen frente a accesos directos por la API REST de Supabase con la clave pública (`anon`), que no debe poder leer ni escribir nada. La tabla `articles_meta_title_respaldo` es un respaldo creado el 19/10/2026 antes de un cambio de datos y se le habilitó RLS el mismo día; puede eliminarse cuando FEDEGÁN decida el título SEO (ver CG-DOC-06, R-10).

# 4. Modelo de datos por dominio

## 4.1 Contenido
- **`articles`**: la nota. Campos clave: `slug` (único), `legacy_path` (dirección original, única cuando existe), `status` (`borrador`, `en_revision`, `programado`, `publicado`, `archivado`), `published_at`, `scheduled_for`, `category_id`, `author_id`, `created_by`, `home_position` (posición fija en portada), `tags` y `secciones` (jsonb), `zonas` (jsonb, ver 6.2), `search_vec` (columna generada para texto completo), `embedding` (vector para búsqueda semántica), `views`, cuerpo en HTML saneado.
- **`categories`** (árbol de secciones con `parent_id` y `sort_order`), **`authors`**, **`redirects`** (301 de direcciones antiguas), **`contact_messages`**.

## 4.2 Acceso y seguridad
- **`users`** (correo único, hash de contraseña, rol, secreto TOTP cifrado, `totp_enabled`), **`passkeys`**, **`sessions`**, **`verification_tokens`**, **`api_clients`** (claves de la API pública, guardadas como huella), **`rate_limits`** (contadores de intentos, usos únicos y límites; se purgan a diario).

## 4.3 Consejo de redacción
- **`editorial_plans`** (consejo por semana: estado `borrador/activo/cerrado`, configuración y temas en jsonb) y **`editorial_slots`** (cada pieza: hora, sección, tema, ficha de pauta, estado, nota enlazada `article_id`, `responsable_visto_at` para el aviso de tarea nueva).

## 4.4 Boletín y audiencia
- **`newsletter_subscribers`**, **`newsletter_editions`**, **`reader_sessions`**, **`subscriber_visitors`** (con casilla de autorización explícita), **`article_views_daily`**, **`push_subscriptions`**.

## 4.5 Inteligencia artificial y datos del Observatorio
- **`assistant_queries`** (consultas del asistente público, para control de gasto y demanda), **`agent_drafts`** (cola de borradores de agentes), **`data_series`** y **`data_points`** (series del Observatorio).

## 4.6 Configuración
- **`site_settings`**: pares clave/valor jsonb con la identidad del sitio, plantilla y diseño de portada, ajustes del boletín (la clave de Resend, **cifrada**), permisos por persona y claves de IA cifradas. **`ads_zones`**: zonas publicitarias.

# 5. Integridad y restricciones

| Mecanismo | Dónde se aplica |
|---|---|
| Claves primarias `uuid` generadas por la base | Todas las tablas de entidades |
| Unicidad | `users.email`, `articles.slug`, `articles.legacy_path` (parcial), `passkeys.credential_id`, claves de configuración |
| Claves foráneas | `articles.category_id → categories`, `articles.author_id → authors`, `editorial_slots.plan_id → editorial_plans` (borrado en cascada), `editorial_slots.article_id → articles` (al borrar la nota queda en nulo), `passkeys.user_id → users`, etc. (detalle en el Anexo A) |
| Tipos enumerados | Estado editorial, rol de usuario y otros (declarados en el esquema) |
| Valores por defecto y obligatoriedad | Declarados por columna (Anexo A, columna «Notas») |
| Validación antes de escribir | Zod y funciones `sanear*` en la capa de aplicación; el HTML de las notas pasa por `sanitize-html` |
| Atomicidad | Toda operación de leer-modificar-escribir sobre la misma fila va en una sola sentencia o en una transacción con `FOR UPDATE` (regla del equipo, `AGENTS.md`) |

Una **prueba automática falla si el esquema declarado y las migraciones divergen** (`src/db/esquema.test.ts`), y la base de pruebas se construye aplicando todas las migraciones desde cero.

# 6. Índices y estructuras derivadas

## 6.1 Índices de `articles` (20, producción)

| Índice | Tipo | Para qué |
|---|---|---|
| `articles_pkey`, `articles_slug_unique`, `articles_legacy_path_idx` | B-tree único | Identidad, dirección nueva y dirección original |
| `articles_status_published_idx` | B-tree (`status`, `published_at`) | Listados públicos y conteos por estado; permite recorridos solo de índice |
| `articles_published_desc_idx`, `articles_updated_idx` | B-tree | Orden por fecha de publicación y de edición |
| `articles_category_idx`, `articles_category_published_idx` | B-tree | Listado de una sección |
| `articles_author_idx` | B-tree (`author_id`, `published_at`) | Página del autor y «mis notas» |
| `articles_portada_idx` | B-tree parcial | Orden de la portada |
| `articles_home_position_idx`, `articles_breaking_idx`, `articles_scheduled_idx`, `articles_views_idx`, `articles_created_by_idx` | B-tree | Posiciones fijas, última hora, programadas, más leídas y propiedad |
| `articles_search_vec_idx` | GIN | Búsqueda de texto completo en español |
| `articles_title_trgm` | GIN (`pg_trgm`) | Búsqueda difusa por título |
| `articles_secciones_idx`, `articles_zonas_idx` | GIN | Pertenencia a secciones adicionales; región y departamento de cada nota |
| `articles_embedding_hnsw` | HNSW (`vector_cosine_ops`) | Búsqueda semántica |

## 6.2 Columna `zonas` y disparador (migración 0023)
Región y departamento que menciona el texto de cada nota se calculan **en la base**, no en la aplicación: la función `articles_zonas_de(texto)` (inmutable) y el disparador `articles_zonas` (antes de insertar o de cambiar título, resumen o etiquetas) mantienen `articles.zonas`. Con ello el filtro de «Regiones» usa el índice GIN en lugar de leer el texto de 51 mil notas (primera visita de 4–11 s a 0,6–1,6 s). Las palabras de cada región salen de `src/lib/regiones-colombia.ts`; la migración las incorpora como texto, de modo que **cambiarlas exige una migración nueva**.

# 7. Migraciones

Las migraciones están en `drizzle/` y son **25 archivos numerados de `0000` a `0024`**. Orden y propósito:

| N.º | Archivo | Propósito |
|---|---|---|
| 0000 | `init` | Esquema inicial |
| 0001–0003 | `add_home_position`, `add_home_size_span`, `home_style_json` | Posición, tamaño y estilo de las notas en portada |
| 0004 | `site_settings` | Configuración clave/valor |
| 0005–0009 | migraciones generadas | Evolución de portada, anuncios, series y asistente |
| 0010 | `passkeys_y_datos_de_suscriptores` | Passkeys y datos de suscriptores |
| 0011–0012 | `lecturas_de_lectores`, `lectura_de_suscriptores` | Medición de lecturas por visitante y suscriptor |
| 0013–0014 | `segmentos_del_boletin`, `programacion_y_secciones_del_boletin` | Segmentación y programación del boletín |
| 0015–0017 | `migracion_del_sitio_anterior`, `busqueda_en_texto_completo`, `direccion_original_de_las_notas` | Soporte de las 51 mil notas migradas, `search_vec`, `legacy_path` |
| 0018–0020 | `indices_del_listado_del_panel`, `indices_por_autor`, `indice_de_la_portada` | Índices de rendimiento |
| 0021–0022 | `consejo_de_redaccion`, `ficha_de_pauta` | Consejo de redacción |
| 0023 | `zonas_de_las_notas` | Región y departamento calculados por la base |
| 0024 | `aviso_de_tarea_nueva` | Aviso de tarea nueva del consejo (`responsable_visto_at`) |

**Reglas del procedimiento** (detalle en CG-DOC-06, R-03): se edita `src/db/schema.ts` → `npm run db:generate` → se revisa el SQL → **cada sentencia debe ser idempotente** (`IF NOT EXISTS`) porque en producción las migraciones **se aplican a mano en el SQL Editor de Supabase** → `npm run db:migrate` en local. Los índices y extensiones que `drizzle-kit` no emite viven en `drizzle/manual/00_pre_extensions.sql` y `99_post_indexes.sql`. El diario de aplicación en producción es el SQL Editor de Supabase (Consultas guardadas / historial) y el historial de Git del archivo.

# 8. Datos personales y sensibles

| Dato | Tabla | Tratamiento |
|---|---|---|
| Contraseñas | `users.password_hash` | Hash `bcrypt`; nunca se guardan en claro |
| Secreto TOTP (segundo factor) | `users.totp_secret` | **Se guarda en texto** (la columna no se cifra a nivel de aplicación). Lo protege el acceso restringido a la base (rol de servicio, RLS sin políticas públicas). **Hallazgo H-D1:** debe cifrarse con una clave derivada, como ya se hace con las claves de IA y de Resend; ver CG-DOC-05 |
| Claves de IA y de Resend guardadas desde el panel | `site_settings` | Cifradas con AES-256-GCM; la aplicación solo muestra una máscara |
| Claves de la API pública | `api_clients` | Se guarda la huella (`key_hash`) y un prefijo para reconocerla; la clave completa se muestra una sola vez al crearla |
| Correo, nombre, celular, fecha de nacimiento y ubicación de suscriptores | `newsletter_subscribers` | Retención y purga automáticas (sección 9) |
| IP del alta | `newsletter_subscribers` | Se borra al confirmar la suscripción |
| Lecturas por visitante | `reader_sessions`, `subscriber_visitors` | Solo con consentimiento; vínculo con suscriptor solo con autorización explícita; retención de 400 días |

# 9. Retención y purga

Ejecutadas por el mantenimiento diario (`src/lib/mantenimiento.ts`), independientes entre sí y con interruptor de apagado:

| Dato | Plazo | Interruptor |
|---|---|---|
| Alta de boletín sin confirmar | 30 días | `RETENCION_BOLETIN=off` |
| Datos personales de quien se dio de baja | 30 días tras la baja | ídem |
| Contadores de `rate_limits` vencidos | 1 hora | — |
| Lecturas por visitante | 400 días (mínimo configurable 30) | `RETENCION_LECTORES` |
| Archivos huérfanos del bucket `media` | 7 días sin uso | `MEDIA_CLEANUP=off` |

Salvaguarda: mientras no haya proveedor de correo configurado no se elimina ninguna alta pendiente (nadie ha podido confirmar).

# 10. Mantenimiento, respaldo y recuperación

- **Autovacío y `VACUUM`.** Después de cargas masivas (como la migración de 51 mil notas) los índices solo-índice quedan desactualizados y el motor debe consultar la tabla fila por fila. El 19/10/2026 un `VACUUM (ANALYZE) articles` redujo la consulta de conteo por estado del panel de **5,6 s a 0,43 s**. Repetirlo tras cualquier carga o actualización masiva.
- **Tiempo máximo por sentencia.** El servicio gestionado cancela sentencias largas (`statement_timeout`): las actualizaciones masivas se hacen **por tandas** (ver CG-DOC-06, R-08).
- **Respaldo y recuperación:** el proyecto está en un plan de pago de Supabase (el panel lo muestra como «PRO»), que incluye copias diarias automáticas gestionadas por el proveedor. **Pendiente de confirmar con FEDEGÁN:** retención efectivamente configurada, si está activada la recuperación a un punto en el tiempo (PITR, complemento de pago) y la **primera prueba de restauración** documentada (CG-DOC-06, R-05, que incluye el formato del acta de prueba).
- **Salud:** `GET /api/health` ejecuta una consulta a la base y devuelve 503 si falla.

# 11. Consultas de verificación para el auditor (solo lectura)

Se pueden ejecutar en el SQL Editor de Supabase con un rol de solo lectura:

```sql
-- Volumen por tabla y tamaño total
select relname, reltuples::bigint as filas_aprox, pg_size_pretty(pg_total_relation_size(oid)) as tamano, relrowsecurity as rls
from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by pg_total_relation_size(oid) desc;

-- Integridad de las notas migradas (debe dar 0 en cada control)
select count(*) filter (where legacy_path is null) as sin_ruta_original,
       count(*) filter (where category_id is null) as sin_categoria,
       count(*) filter (where author_id is null) as sin_autor,
       count(*) filter (where published_at is null) as sin_fecha,
       count(*) filter (where cover_image_url like '%storyblok%') as portada_en_origen
from articles where legacy_path is not null;

-- Notas por estado
select status, count(*) from articles group by status order by 2 desc;

-- Cuentas con 2FA activo y rol
select role, count(*) as cuentas, count(*) filter (where totp_enabled) as con_2fa from users where active group by role;

-- Tablas sin seguridad por fila (debe estar vacío)
select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;

-- Triggers y funciones propias
select tgname, tgrelid::regclass from pg_trigger where not tgisinternal and tgrelid::regclass::text not like 'storage.%' and tgrelid::regclass::text not like 'realtime.%';
```

Resultados de referencia (19/10/2026): 51.381 notas migradas con 0 sin ruta original, categoría, autor ni fecha, y 0 portadas apuntando al servidor anterior; 1 disparador propio (`articles_zonas`); 0 tablas de aplicación sin RLS tras el ajuste de la tabla de respaldo.

# Anexo A. Diccionario de datos completo

Generado automáticamente desde `src/db/schema.ts` (`npm run docs:bd`): para cada tabla, el módulo dueño, el nombre en el esquema, y cada columna con su tipo y restricciones. Es la referencia que se contrasta con la base de producción mediante las consultas de la sección 11.

<!--DICCIONARIO-->
