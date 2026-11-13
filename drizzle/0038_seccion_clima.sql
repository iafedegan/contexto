-- Sección «Clima»: sección principal nueva, después de «Tendencias» en el menú, que reúne las notas sobre clima SIN sacarlas de su sección.
-- Cada nota conserva su sección principal (`category_id`) y además sale en Clima porque se le suma «clima» a `secciones`.
-- Idempotente: se pega a mano en el SQL Editor de Supabase y puede correr dos veces (no duplica la sección ni la marca de las notas).

-- 1. La sección. En una base recién creada (sin secciones todavía) no hace nada: ahí la crea la siembra (`src/db/seed-data.ts`).
DO $$
DECLARE pos integer;
BEGIN
  IF EXISTS (SELECT 1 FROM "categories" WHERE "parent_id" IS NULL) AND NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'clima') THEN
    SELECT "sort_order" INTO pos FROM "categories" WHERE "slug" = 'tendencias' AND "parent_id" IS NULL;
    IF pos IS NULL THEN
      -- Sin «Tendencias» como sección principal: Clima queda al final.
      SELECT coalesce(max("sort_order"), 0) INTO pos FROM "categories" WHERE "parent_id" IS NULL;
    ELSE
      -- Le abre el puesto: las secciones principales que iban después de Tendencias se corren uno.
      UPDATE "categories" SET "sort_order" = "sort_order" + 1 WHERE "parent_id" IS NULL AND "sort_order" > pos;
    END IF;
    INSERT INTO "categories" ("slug", "name", "description", "sort_order")
    VALUES ('clima', 'Clima', 'Lluvias, sequías, fenómenos de El Niño y La Niña, pronósticos y cambio climático en el campo.', pos + 1);
  END IF;
END $$;
--> statement-breakpoint

-- 2. Las notas. Entra a Clima la nota que habla de clima en su TÍTULO o en sus ETIQUETAS (una mención de paso en el resumen no basta).
-- El texto se compara en minúsculas y sin tildes, por palabras completas; «El Niño» y «La Niña» se buscan con sus mayúsculas para no
-- confundirlos con un niño o una niña. Una sola sentencia: no pisa lo que un editor esté guardando en la misma nota.
UPDATE "articles" SET "secciones" = "secciones" || '["clima"]'::jsonb
WHERE NOT "secciones" ? 'clima'
  AND "category_id" IS DISTINCT FROM (SELECT "id" FROM "categories" WHERE "slug" = 'clima')
  AND (
    translate(lower(coalesce("title", '')), 'áéíóúüñ', 'aeiouun')
      ~ '\m(climas?|climatic[oa]s?|climatolog[a-z]+|calentamiento global|efecto invernadero|lluvias?|lluvios[oa]s?|aguaceros?|precipitaciones|sequias?|fenomeno (de |del |de el |de la |el |la )?nin[oa]|ideam|heladas?|inundacion(es)?|inundad[oa]s?|invierno|invernal(es)?|verano|veranillo|temporada seca|epoca seca|granizadas?|granizo|vendaval(es)?|huracan(es)?|tormentas? tropical(es)?|ola de calor|ola de frio|frentes? frios?|meteorolog[a-z]+)\M'
    OR "title" ~ '\m(El Niño|La Niña)\M'
    OR translate(lower(coalesce("tags"::text, '')), 'áéíóúüñ', 'aeiouun') ~ '\m(clima|cambio climatico|sequia|lluvias?|el nino|la nina|ideam)\M'
  );
--> statement-breakpoint

-- 3. Cuántas notas quedaron en Clima (lo muestra el SQL Editor al terminar).
SELECT count(*) AS notas_en_clima FROM "articles" WHERE "secciones" ? 'clima';
