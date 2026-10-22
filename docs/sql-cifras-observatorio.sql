-- Crea la tabla observatorio_datos (si falta) y la llena desde las copias que ya hay en site_settings
-- (observatorio_snapshot e indicadores_snapshot). Idempotente: se puede ejecutar varias veces.
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
);
CREATE INDEX IF NOT EXISTS "observatorio_datos_consulta_idx" ON "observatorio_datos" USING btree ("tema","indicador","fecha");
ALTER TABLE "observatorio_datos" ENABLE ROW LEVEL SECURITY;

-- «sep/2026» → 2026-09-01; «2025» → 2025-01-01.
CREATE OR REPLACE FUNCTION pg_temp.fecha_periodo(p text) RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p ~ '^\d{4}$' THEN make_date(p::int, 1, 1)
    WHEN lower(p) ~ '^[a-z]{3}[a-z]*[/ -]\d{4}$' THEN make_date(
      substring(p from '(\d{4})$')::int,
      array_position(ARRAY['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'], left(lower(p),3)),
      1)
    ELSE NULL END
$$;

WITH snap AS (SELECT value::jsonb AS v FROM site_settings WHERE key = 'observatorio_snapshot'),
-- Indicadores generales (producción, consumo, internacional, costos).
generales AS (
  SELECT g->>'grupo' AS tema, g->>'clave' AS indicador, g->>'titulo' AS titulo, coalesce(g->>'unidad','') AS unidad, coalesce(g->>'fuente','') AS fuente,
         s->>'nombre' AS serie, per.p AS periodo, (val.x)::double precision AS valor
  FROM snap, jsonb_array_elements(v->'generales') g,
       jsonb_array_elements(g->'series') s,
       LATERAL jsonb_array_elements_text(g->'periodos') WITH ORDINALITY AS per(p, i),
       LATERAL (SELECT (s->'valores'->>((per.i - 1)::int)) AS x) val
  WHERE val.x IS NOT NULL
),
-- Inventario por departamento y total nacional.
dep AS (
  SELECT 'inventario' AS tema, d->>'clave' AS indicador, d->>'titulo' AS titulo, coalesce(d->>'unidad','') AS unidad,
         'FEDEGÁN · Sistema de información estadística' AS fuente, s->>'nombre' AS serie, per.p AS periodo, (val.x)::double precision AS valor
  FROM snap, jsonb_array_elements(v->'departamental') d,
       jsonb_array_elements(d->'departamentos') s,
       LATERAL jsonb_array_elements_text(d->'periodos') WITH ORDINALITY AS per(p, i),
       LATERAL (SELECT (s->'valores'->>((per.i - 1)::int)) AS x) val
  WHERE val.x IS NOT NULL
  UNION ALL
  SELECT 'inventario', d->>'clave', d->>'titulo', coalesce(d->>'unidad',''), 'FEDEGÁN · Sistema de información estadística', 'Total nacional', per.p,
         (val.x)::double precision
  FROM snap, jsonb_array_elements(v->'departamental') d,
       LATERAL jsonb_array_elements_text(d->'periodos') WITH ORDINALITY AS per(p, i),
       LATERAL (SELECT (d->'nacional'->>((per.i - 1)::int)) AS x) val
  WHERE val.x IS NOT NULL
),
-- Hato por orientación.
hato AS (
  SELECT 'hato', h->>'clave', h->>'titulo', CASE WHEN h->>'clave' = 'predios' THEN 'predios' ELSE 'cabezas' END,
         'FEDEGÁN · Sistema de información estadística', p->>'nombre', h->>'periodo', (p->>'valor')::double precision
  FROM snap, jsonb_array_elements(v->'hato') h, jsonb_array_elements(h->'partes') p
),
-- Precios de la portada.
precios AS (
  SELECT 'precios', g->>'clave', g->>'titulo', coalesce(g->>'unidad',''), coalesce(g->>'fuente',''), s->>'nombre', per.p, (val.x)::double precision
  FROM (SELECT value::jsonb AS v FROM site_settings WHERE key = 'indicadores_snapshot') snap2,
       jsonb_array_elements(v) g, jsonb_array_elements(g->'series') s,
       LATERAL jsonb_array_elements_text(g->'periodos') WITH ORDINALITY AS per(p, i),
       LATERAL (SELECT (s->'valores'->>((per.i - 1)::int)) AS x) val
  WHERE val.x IS NOT NULL
),
todo AS (
  SELECT * FROM generales UNION ALL SELECT * FROM dep UNION ALL SELECT * FROM hato UNION ALL SELECT * FROM precios
)
INSERT INTO observatorio_datos (tema, indicador, titulo, unidad, fuente, serie, periodo, fecha, valor)
SELECT tema, indicador, titulo, unidad, fuente, serie, periodo, pg_temp.fecha_periodo(periodo), valor FROM todo
ON CONFLICT (tema, indicador, serie, periodo) DO UPDATE SET valor = excluded.valor, actualizado_en = now();

SELECT tema, count(*) AS filas FROM observatorio_datos GROUP BY tema ORDER BY tema;
