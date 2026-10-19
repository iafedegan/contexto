-- Título SEO de las notas migradas: vuelve al titular, que es lo que mostraba el sitio actual en la pestaña y en Google.
-- El respaldo `articles_meta_title_respaldo` (7.391 filas) YA está creado en producción: sirve para deshacerlo.
-- Se ejecuta por tandas (una sola sentencia supera el tiempo máximo del editor). Repetir cambiando el dígito: '0123', '4567', '89ab', 'cdef'.

update articles a set meta_title = null
from articles_meta_title_respaldo r
where a.id = r.id and a.meta_title is not null and substr(a.id::text,1,1) in ('0','1','2','3');

-- Comprobación (debe dar 0 al terminar las cuatro tandas):
-- select count(*) from articles a join articles_meta_title_respaldo r on r.id = a.id where a.meta_title is not null;

-- Para DESHACER:
-- update articles a set meta_title = r.meta_title from articles_meta_title_respaldo r where a.id = r.id;
