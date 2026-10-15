# Migración del sitio anterior (contextoganadero.com) al portal nuevo

Objetivo: que el día que se apague el sitio anterior (Next.js + Storyblok) el portal nuevo quede **en la misma dirección, con todas las
notas, las mismas direcciones funcionando y sin que un lector ni un buscador note el cambio**.

Esto reemplaza el «Principio #1» del contrato original («los ~41.000 artículos permanecen en el sistema actual»): ahora **las notas del
archivo viven en la tabla `articles`**, con su categoría, autor, imágenes propias y SEO. El cliente del archivo (`archive-client.ts`,
tabla `archive_index`, cron `sync-archive`) queda sin uso y se puede retirar cuando se apague el sitio anterior.

## Qué se migra y cómo

| Del sitio anterior | Al portal nuevo |
|---|---|
| ~51.500 notas de 29 carpetas (`/regiones/…`, `/columna/…`, `/galeria/…`…) | Una fila en `articles` por nota, `status = publicado`, con la fecha de publicación original |
| Cuerpo (Markdown→HTML) | HTML saneado con `sanitizeArticleHtml`. Tuits e Instagram/TikTok/Facebook incrustados pasan a **enlace**; YouTube se conserva (sin cookies); los scripts de terceros se eliminan |
| Galerías de fotos, videos de YouTube, audios | Se añaden al final del cuerpo (`<figure><img>`, iframe `youtube-nocookie`, `<audio>`) |
| Imágenes (`a.storyblok.com`) | Se **copian** al bucket `media` de Supabase (`mig-<huella>.webp`, máx. 1.600 px) y las notas apuntan a la copia: no dependen de Storyblok |
| Pie de foto y crédito de la imagen | `articles.cover_image_caption`, se muestra bajo la portada |
| Autor | Se reconoce por nombre o dirección; los que faltan se crean (con su foto) |
| Secciones marcadas (`home`, `colombia`, `regiones`, `gremialidad`…) | La más específica es la **categoría principal** (`category_id`); todas se guardan en `articles.secciones` y la página de cada categoría también lista las notas que la marcaron |
| Etiquetas, título/descripción SEO | `tags`, `meta_title`, `meta_description` |
| Carpetas `galeria`, `video`, `audio`, `blog` y la sección `seguridad` | Categorías nuevas **Galería** (en Especiales), **Video** (en TV), **Audio** (en Radio) y **Seguridad** (en Colombia), y la dirección antigua `/blog` en Blogs |
| Cada dirección antigua `/seccion/titulo` | **La misma dirección**: la nota se sirve ahí, sin redirección (`articles.legacy_path`, ruta `app/(public)/[seccion]/[slug]`), con su canónica igual a sí misma. Solo la copia repetida de una nota en dos secciones redirige (301) a la otra. `/articulo/<slug>` sigue abriendo la nota pero con `noindex` y canónica a la original. La ruta comodín busca por título las notas publicadas después de la última carga |
| Páginas de columnista `/SearchColumnista/<id>/<n>` | 301 a `/autor/<slug>` |
| Páginas institucionales `/PoliticaEmpresarioView/…`, `/sitemap-N.xml`, `/SeemoreNews` | 301 a su equivalente (`src/lib/redirects.ts`) |
| `/sitemap.xml` (índice de 6 mapas) | `/sitemap.xml` es ahora un índice (`/sitemaps/paginas.xml` + `/sitemaps/notas-N.xml`, 10.000 notas por archivo) |
| `ads.txt` | `public/ads.txt` (misma línea de Google) |

Direcciones: **no cambia ninguna**. Dominio y ruta quedan exactamente iguales (`https://www.contextoganadero.com/regiones/titulo`), así que para Google
es la misma página: no hay traslado ni reindexación que esperar. Incluye las ≈430 notas con mayúsculas, signos o guiones en el título, que conservan su
dirección original tal cual (en `articles.slug` van normalizadas, pero se sirven en `legacy_path`). Si dos secciones tenían el mismo título: si era la **misma
nota** (mismo título y fecha) se sirve en una dirección y la otra redirige a ella; si eran **notas distintas**, las dos se sirven cada una en la suya.

## Pasos (en este orden)

Todo se ejecuta desde la carpeta del proyecto. Los pasos de descarga, carga y verificación se pueden repetir sin riesgo: no duplican nada.

1. **Base de datos**: pegar `docs/migracion-sitio-anterior.sql` en el SQL Editor de Supabase (reúne las migraciones 0014 a 0017; son idempotentes).
   Añade el pie de foto, las secciones adicionales, la columna de búsqueda `search_vec` (con su índice) y `legacy_path` (la dirección original de cada nota). Hay que hacerlo **antes** de desplegar y de cargar.
2. **Desplegar** el código de esta rama (`push main`). Lo nuevo que necesita: categorías con secciones adicionales, mapa del sitio por partes,
   redirecciones de páginas antiguas, búsqueda sobre `search_vec` y el encabezado `noindex` fuera del dominio oficial.
3. **Descargar** el sitio anterior a la caché local (`.migracion-cache/`, ~600 MB, fuera de git). Tarda ~1 hora y se puede interrumpir y reanudar
   (ya hecho una vez: 51.527 de las 51.535 direcciones; las 8 restantes dan 404 o 500 también en el sitio anterior):
   ```bash
   npm run migracion:descargar
   ```
4. **Ensayo** contra la base local (no toca producción) y revisar `.migracion-cache/informe-carga.json`:
   ```bash
   npm run migracion:cargar -- --sin-imagenes
   ```
5. **Carga real** (si ya hubo una carga anterior, repetirla es lo que graba `legacy_path` en cada nota, reescribe los enlaces internos y limpia las redirecciones sobrantes; las imágenes ya copiadas no se vuelven a bajar) (base y almacenamiento de Supabase; usa `DATABASE_URL`/`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` del entorno o de `.env.migracion`).
   Primero un simulacro que solo lee, y después la carga: ~1,5–2 horas por las imágenes (≈39.500 archivos, ≈9 GB); si se corta, se vuelve a lanzar y sigue:
   ```bash
   npm run migracion:cargar -- --produccion --simulacro
   npm run migracion:cargar -- --produccion
   ```
6. **Verificar**: conciliación completa contra la base y una muestra contra el sitio desplegado (ritmo lento a propósito: el portal limita ~120 peticiones/min por IP, así que `--ritmo` no debe bajar de 900):
   ```bash
   npm run migracion:verificar -- --produccion --base=https://contexto-olive.vercel.app --muestra=300 --ritmo=900
   ```

## Día del cambio (cutover)

Antes: repetir el paso 3 con `--refrescar=800` (vuelve a pedir las 800 notas más recientes, por si se editaron, y trae lo publicado desde la última
descarga), luego el 5 y el 6.

1. En Vercel, añadir el dominio `www.contextoganadero.com` (y `contextoganadero.com` redirigiendo al `www`, como hoy).
2. Variables de entorno de producción: `NEXT_PUBLIC_SITE_URL=https://www.contextoganadero.com`. Para conservar la analítica del sitio anterior:
   `NEXT_PUBLIC_GTM_ID=GTM-5K7WVL8` (el contenedor que usa hoy) y/o el `NEXT_PUBLIC_GA4_ID` de la propiedad vigente. Quitar `SITIO_ANTIGUO_URL` si estaba.
3. Cambiar el DNS (en Cloudflare, que hoy está delante del sitio anterior) para que `www` apunte a Vercel. TTL bajo la víspera.
4. Con el dominio ya sirviendo el portal nuevo: comprobar `/robots.txt`, `/sitemap.xml`, `/ads.txt`, una nota antigua (debe redirigir con 301) y la portada.
5. Search Console: enviar `https://www.contextoganadero.com/sitemap.xml` (mismo archivo que ya tenían; ahora es un índice) y vigilar «Páginas» y «Estadísticas de rastreo» las dos primeras semanas.
6. Mientras el dominio no sea el oficial, cualquier otra dirección que sirva el portal (`*.vercel.app`) responde `noindex` y su `robots.txt` lo prohíbe todo
   (`src/lib/indexacion.ts`), para que no compita con el sitio oficial.

Después de unos días sin incidencias: apagar el sitio anterior, **cancelar Storyblok** (las imágenes ya están copiadas) y rotar las credenciales que se usaron
para la migración (`.env.migracion`: acceso a R2, contraseña de la base y clave `service_role`).

## Qué mirar si algo no cuadra

- `.migracion-cache/informe-carga.json`: conteos, autores nuevos, direcciones normalizadas, repetidas, sin portada.
- `.migracion-cache/informe-verificacion.json`: direcciones sin redirección, redirecciones a notas inexistentes, notas con imágenes sin copiar.
- `.migracion-cache/imagenes-fallos.log` / `fallos.log`: lo que no se pudo descargar (se reintenta en la siguiente corrida).
- Una nota que la redacción editó en el panel **no se sobrescribe** al repetir la carga (solo se pisan las filas sin autor de panel, `created_by IS NULL`).
