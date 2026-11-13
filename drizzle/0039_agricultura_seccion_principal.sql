-- «Agricultura» deja de ser subsección de Economía y pasa a sección principal, justo después de Economía en la barra.
-- Sus notas conservan su sección (`category_id` no cambia). Idempotente: si ya es principal no hace nada.
DO $$
DECLARE pos integer; aid uuid;
BEGIN
  SELECT "id" INTO aid FROM "categories" WHERE "slug" = 'agricultura' AND "parent_id" IS NOT NULL;
  IF aid IS NOT NULL THEN
    SELECT "sort_order" INTO pos FROM "categories" WHERE "slug" = 'economia' AND "parent_id" IS NULL;
    IF pos IS NULL THEN
      SELECT coalesce(max("sort_order"), 0) INTO pos FROM "categories" WHERE "parent_id" IS NULL;
    ELSE
      UPDATE "categories" SET "sort_order" = "sort_order" + 1 WHERE "parent_id" IS NULL AND "sort_order" > pos;
    END IF;
    UPDATE "categories" SET "parent_id" = NULL, "sort_order" = pos + 1 WHERE "id" = aid;
  END IF;
END $$;
