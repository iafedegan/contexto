-- Zonas de cada nota: región y departamento que menciona su texto, calculados por la base para filtrar con un índice.
-- Idempotente (se aplica a mano en el SQL Editor de Supabase). Los términos salen de src/lib/regiones-colombia.ts.
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "zonas" jsonb DEFAULT '[]'::jsonb NOT NULL;
CREATE INDEX IF NOT EXISTS "articles_zonas_idx" ON "articles" USING gin ("zonas");
CREATE OR REPLACE FUNCTION articles_zonas_de(txt text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $f$
  SELECT coalesce(jsonb_agg(z), '[]'::jsonb) FROM (
    select 'region-caribe' where txt like any (array['%atlantico%', '%bolivar%', '%cesar%', '%cordoba%', '%guajira%', '%magdalena%', '%sucre%', '%caribe%', '%barranquilla%', '%cartagena%', '%santa marta%', '%monteria%', '%valledupar%', '%sincelejo%', '%riohacha%'])
    union all
    select 'region-andina' where txt like any (array['%antioquia%', '%boyaca%', '%caldas%', '%cundinamarca%', '%bogota%', '%huila%', '%norte de santander%', '%quindio%', '%risaralda%', '%santander%', '%tolima%', '%andina%', '%medellin%', '%manizales%', '%pereira%', '%armenia%', '%ibague%', '%neiva%', '%cucuta%', '%bucaramanga%', '%tunja%'])
    union all
    select 'region-pacifico' where txt like any (array['%cauca%', '%choco%', '%narino%', '%valle del cauca%', '%pacifico%', '%cali%', '%popayan%', '%pasto%', '%quibdo%'])
    union all
    select 'region-orinoquia' where txt like any (array['%arauca%', '%casanare%', '%meta%', '%vichada%', '%orinoquia%', '%llanos%', '%villavicencio%', '%yopal%'])
    union all
    select 'region-amazonia' where txt like any (array['%amazonas%', '%caqueta%', '%guainia%', '%guaviare%', '%putumayo%', '%vaupes%', '%amazonia%', '%florencia%', '%mocoa%', '%leticia%'])
    union all
    select 'region-insular' where txt like any (array['%san andres%', '%providencia%', '%insular%', '%archipielago%'])
    union all
    select 'depto-antioquia' where txt like any (array['%antioquia%', '%medellin%'])
    union all
    select 'depto-boyaca' where txt like any (array['%boyaca%', '%tunja%', '%duitama%', '%sogamoso%'])
    union all
    select 'depto-caldas' where txt like any (array['%caldas%', '%manizales%'])
    union all
    select 'depto-cundinamarca' where txt like any (array['%cundinamarca%', '%bogota%'])
    union all
    select 'depto-huila' where txt like any (array['%huila%', '%neiva%'])
    union all
    select 'depto-norte-de-santander' where txt like any (array['%norte de santander%', '%cucuta%'])
    union all
    select 'depto-quindio' where txt like any (array['%quindio%', '%armenia%'])
    union all
    select 'depto-risaralda' where txt like any (array['%risaralda%', '%pereira%'])
    union all
    select 'depto-santander' where txt like any (array['%santander%', '%bucaramanga%'])
    union all
    select 'depto-tolima' where txt like any (array['%tolima%', '%ibague%'])
    union all
    select 'depto-atlantico' where txt like any (array['%atlantico%', '%barranquilla%'])
    union all
    select 'depto-bolivar' where txt like any (array['%bolivar%', '%cartagena%'])
    union all
    select 'depto-cesar' where txt like any (array['%cesar%', '%valledupar%'])
    union all
    select 'depto-cordoba' where txt like any (array['%cordoba%', '%monteria%'])
    union all
    select 'depto-la-guajira' where txt like any (array['%guajira%', '%riohacha%'])
    union all
    select 'depto-magdalena' where txt like any (array['%magdalena%', '%santa marta%'])
    union all
    select 'depto-sucre' where txt like any (array['%sucre%', '%sincelejo%'])
    union all
    select 'depto-cauca' where txt like any (array['%cauca%', '%popayan%'])
    union all
    select 'depto-choco' where txt like any (array['%choco%', '%quibdo%'])
    union all
    select 'depto-narino' where txt like any (array['%narino%', '%pasto%'])
    union all
    select 'depto-valle-del-cauca' where txt like any (array['%valle del cauca%', '%cali%'])
    union all
    select 'depto-arauca' where txt like any (array['%arauca%'])
    union all
    select 'depto-casanare' where txt like any (array['%casanare%', '%yopal%'])
    union all
    select 'depto-meta' where txt like any (array['%meta%', '%villavicencio%'])
    union all
    select 'depto-vichada' where txt like any (array['%vichada%', '%puerto carreno%'])
    union all
    select 'depto-amazonas' where txt like any (array['%amazonas%', '%leticia%'])
    union all
    select 'depto-caqueta' where txt like any (array['%caqueta%', '%florencia%'])
    union all
    select 'depto-guainia' where txt like any (array['%guainia%', '%inirida%'])
    union all
    select 'depto-guaviare' where txt like any (array['%guaviare%', '%san jose del guaviare%'])
    union all
    select 'depto-putumayo' where txt like any (array['%putumayo%', '%mocoa%'])
    union all
    select 'depto-vaupes' where txt like any (array['%vaupes%', '%mitu%'])
    union all
    select 'depto-san-andres-y-providencia' where txt like any (array['%san andres%', '%providencia%'])
  ) q(z)
$f$;
CREATE OR REPLACE FUNCTION articles_zonas_trg() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  NEW.zonas := articles_zonas_de(translate(lower(coalesce(NEW.title, '') || ' ' || coalesce(NEW.excerpt, '') || ' ' || coalesce(NEW.tags::text, '')), 'áéíóúñ', 'aeioun'));
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS articles_zonas ON "articles";
CREATE TRIGGER articles_zonas BEFORE INSERT OR UPDATE OF title, excerpt, tags ON "articles" FOR EACH ROW EXECUTE FUNCTION articles_zonas_trg();
UPDATE "articles" SET "zonas" = articles_zonas_de(translate(lower(coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(tags::text, '')), 'áéíóúñ', 'aeioun')) WHERE "zonas" = '[]'::jsonb;

-- Comprobación: cuántas notas quedaron marcadas.
select count(*) filter (where zonas <> '[]'::jsonb) as marcadas, count(*) as total from articles;
