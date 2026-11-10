-- Cada lectura de una nota hace `views = views + 1`. Con un índice sobre `views` ninguna de esas actualizaciones podía ser «HOT» y
-- reescribía los 21 índices de `articles` (también el HNSW de vectores): 149 ms de media, picos de 6,6 s, y en una nota viral todas
-- en fila por la misma fila. El índice casi no se usaba (184 lecturas en total): «más leídos» siempre filtra antes por sección o fecha.
DROP INDEX IF EXISTS "articles_views_idx";--> statement-breakpoint
-- Espacio libre en cada página para que esas actualizaciones quepan en la misma página (HOT). Vale para las páginas que se escriban desde ahora.
ALTER TABLE "articles" SET (fillfactor = 90);
