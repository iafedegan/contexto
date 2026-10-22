/**
 * Reglas de la consulta SQL que la IA escribe para el asistente. Todo puro (sin base de datos): decide si una sentencia es aceptable y la
 * envuelve para que SOLO pueda ver dos «tablas» preparadas, `notas` (las notas publicadas) y `cifras` (el Observatorio).
 *
 * Defensa en capas: aquí se aceptan solo SELECT de una sentencia sin comentarios ni palabras de escritura; al ejecutarla, además, va en una
 * transacción de solo lectura, con tope de tiempo y de filas, y con el `search_path` vacío, de modo que ninguna tabla real se puede nombrar.
 */
export const MAX_LARGO_SQL = 1500;
export const MAX_FILAS_SQL = 25;

const PROHIBIDAS =
  /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|execute|call|do|set|reset|listen|notify|vacuum|analyze|refresh|lock|into|returning|begin|commit|rollback|savepoint|prepare|declare|fetch|show|explain|merge|import|security|owner|pg_sleep|sleep)\b|pg_|information_schema|current_setting|set_config|dblink|lo_[a-z]|nextval|setval|\bpublic\s*\.|\$|\\|--|\/\*/i;

// Quita el contenido de los literales «'…'» para revisar solo el código (una nota puede hablar de «set» o «delete» sin ser una orden).
const sinLiterales = (sql: string) => sql.replace(/'(?:[^']|'')*'/g, "''");

/** La sentencia limpia si es aceptable (un solo SELECT/WITH de solo lectura), o `null`. */
export function validarSelect(bruto: string): string | null {
  let sql = bruto.trim().replace(/^```(?:sql)?/i, "").replace(/```$/, "").trim().replace(/;\s*$/, "").trim();
  if (!sql || sql.length > MAX_LARGO_SQL) return null;
  if (!/^(select|with)\b/i.test(sql)) return null;
  const codigo = sinLiterales(sql);
  if (codigo.includes(";")) return null;
  if (PROHIBIDAS.test(codigo)) return null;
  // Una CTE propia no puede ocultar las tablas preparadas.
  if (/\b(notas|cifras)\s+as\s*\(/i.test(codigo)) return null;
  sql = sql.replace(/\s+/g, " ");
  return sql;
}

/** Lo que ve la IA: nada más que estas dos fuentes. `public.` solo aparece aquí, en lo que escribimos nosotros. */
const PREPARADAS =
  "notas AS (SELECT a.id, a.title, a.excerpt, a.published_at, a.cover_image_url AS image, coalesce(a.legacy_path, '/articulo/' || a.slug) AS url, c.name AS category, a.search_vec " +
  "FROM public.articles a LEFT JOIN public.categories c ON c.id = a.category_id WHERE a.status = 'publicado'), " +
  "cifras AS (SELECT tema, indicador, titulo, unidad, fuente, serie, periodo, fecha, valor FROM public.observatorio_datos)";

/** La sentencia lista para ejecutar: las fuentes preparadas delante y un tope de filas. */
export function envolver(sql: string): string {
  const cuerpo = /^with\b/i.test(sql) ? `WITH ${PREPARADAS}, ${sql.replace(/^with\s+(recursive\s+)?/i, "")}` : `WITH ${PREPARADAS} ${sql}`;
  return `SELECT * FROM (${cuerpo}) AS resultado LIMIT ${MAX_FILAS_SQL}`;
}
