-- Quita de las direcciones de las notas el sufijo al azar (`…-mwp9bxru`, la fecha en base 36) y deja una redirección 301 de la dirección vieja a la nueva.
-- Se corre a mano en el SQL Editor de Supabase. Es idempotente: si no queda ninguna nota con sufijo, no cambia nada. Una sola sentencia = una sola transacción.
-- Para VER antes qué cambiaría, corre solo el SELECT de la sección «Vista previa» de más abajo.
--
-- Vista previa (no escribe nada):
--   select a.slug as ahora, regexp_replace(a.slug, '-[l-n][0-9a-z]{7}$', '') as limpia
--   from articles a where a.slug ~ '-[l-n][0-9a-z]{7}$' order by a.created_at;

with candidatas as (
  select a.id, a.slug, a.legacy_path, a.created_at, c.slug as categoria,
         regexp_replace(a.slug, '-[l-n][0-9a-z]{7}$', '') as base,
         -- Dirección pública actual (igual que `rutaDeNota` en src/lib/ruta-nota.ts).
         coalesce(a.legacy_path,
           case when c.slug in ('columnas', 'columna', 'opinion', 'columnistas') then '/columna/' || a.slug else '/articulo/' || a.slug end) as ruta_vieja
  from articles a left join categories c on c.id = a.category_id
  where a.slug ~ '-[l-n][0-9a-z]{7}$'
),
orden as (
  select c.*,
         row_number() over (partition by c.base order by c.created_at, c.id) as n,
         -- ¿La dirección limpia ya la usa otra nota que NO se está limpiando?
         exists (select 1 from articles o where o.slug = c.base and o.slug !~ '-[l-n][0-9a-z]{7}$' and o.id <> c.id) as base_tomada
  from candidatas c
),
nuevas as (
  select o.*,
         case
           when not o.base_tomada and o.n = 1 then o.base
           else left(o.base, 93) || '-' || (case when o.base_tomada then o.n + 1 else o.n end)::text
         end as slug_nuevo
  from orden o
),
cambios as (
  select n.*,
         case when n.legacy_path is not null and right(n.legacy_path, length(n.slug)) = n.slug
              then left(n.legacy_path, length(n.legacy_path) - length(n.slug)) || n.slug_nuevo
              else n.legacy_path end as legacy_nuevo
  from nuevas n
),
actualizadas as (
  update articles a
  set slug = c.slug_nuevo, legacy_path = c.legacy_nuevo, updated_at = now()
  from cambios c
  where a.id = c.id
  returning a.id, c.ruta_vieja, c.slug as slug_viejo,
            coalesce(c.legacy_nuevo,
              case when c.categoria in ('columnas', 'columna', 'opinion', 'columnistas') then '/columna/' || c.slug_nuevo else '/articulo/' || c.slug_nuevo end) as ruta_nueva
),
redirigidas as (
  -- La dirección vieja (y la de /articulo, por si se enlazó así) redirigen a la nueva.
  insert into redirects (from_path, to_path, status_code)
  select desde, u.ruta_nueva, 301
  from actualizadas u, lateral (select u.ruta_vieja as desde union select '/articulo/' || u.slug_viejo) as v
  where desde <> u.ruta_nueva
  on conflict (from_path) do update set to_path = excluded.to_path, status_code = 301
  returning from_path
)
select (select count(*) from actualizadas) as direcciones_limpiadas, (select count(*) from redirigidas) as redirecciones_creadas;
