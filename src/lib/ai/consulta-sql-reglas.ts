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
  /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|execute|call|do|set|reset|listen|notify|vacuum|analyze|refresh|lock|into|returning|begin|commit|rollback|savepoint|prepare|declare|fetch|show|explain|merge|import|security|owner|pg_sleep|sleep|case|user|session_user|current_user|current_role|current_schema|current_schemas|current_catalog|current_database|version|table)\b|pg_|\|\||"|information_schema|current_setting|set_config|dblink|lo_[a-z]|nextval|setval|\bpublic\s*\.|\$|\\|--|\/\*/i;

// Quita el contenido de los literales «'…'» para revisar solo el código (una nota puede hablar de «set» o «delete» sin ser una orden).
const sinLiterales = (sql: string) => sql.replace(/'(?:[^']|'')*'/g, "''");

// Lo único que la sentencia puede llamar: agregados, fechas y búsqueda de texto. Sin esta lista, `version()` o `query_to_xml(...)` serían válidas.
const FUNCIONES = new Set(
  ("count sum avg min max round abs ceil floor coalesce nullif greatest least lower upper length left date_trunc extract to_char now row_number rank dense_rank lag lead " +
    "to_tsquery websearch_to_tsquery plainto_tsquery to_tsvector ts_rank " +
    // Palabras de SQL que pueden ir seguidas de un paréntesis.
    "select from where and or not in any all exists as on over filter partition using distinct having by when then else values interval numeric int integer float").split(" "),
);
// Lo que puede seguir a un texto entre comillas. Otra palabra sería su alias: `'x' title` fabricaría una nota o una cifra que no existe.
const TRAS_LITERAL = new Set("and or from where order group limit having as on join left right inner outer union then else end desc asc not is like ilike".split(" "));

/** ¿Lee solo de `notas`, `cifras` y sus propias subconsultas? Revisa las tablas, los prefijos (`auth.users`) y las funciones. */
function soloFuentesPermitidas(codigo: string): boolean {
  const permitidas = new Set(["notas", "cifras"]);
  for (const m of codigo.matchAll(/(?:\bwith\s+|,\s*)(\w+)\s+as\s*\(/gi)) permitidas.add(m[1].toLowerCase());
  // «extract(year from x)» y «substring(x from 1)» no leen ninguna tabla.
  const sinExtract = codigo.replace(/\bextract\s*\(\s*\w+\s+from\b/gi, "extract(");
  for (const m of sinExtract.matchAll(/\b(?:from|join)\s+(\(|[\w.]+)/gi)) {
    if (m[1] !== "(" && !permitidas.has(m[1].toLowerCase())) return false;
  }
  // «FROM notas, auth.users»: nada puede ir detrás de una coma en FROM salvo otra fuente permitida.
  for (const m of sinExtract.matchAll(/\bfrom\s+\w+(?:\s+(?:as\s+)?\w+)?\s*,\s*([\w.]+)/gi)) {
    if (!permitidas.has(m[1].toLowerCase())) return false;
  }
  const alias = new Set(permitidas);
  for (const m of sinExtract.matchAll(/\b(?:from|join)\s+\w+\s+(?:as\s+)?(\w+)/gi)) alias.add(m[1].toLowerCase());
  for (const m of sinExtract.matchAll(/\)\s*(?:as\s+)?(\w+)/gi)) alias.add(m[1].toLowerCase());
  for (const m of sinExtract.matchAll(/\b([a-z_]\w*)\s*\./gi)) {
    if (!alias.has(m[1].toLowerCase())) return false;
  }
  for (const m of sinExtract.matchAll(/\b([a-z_]\w*)\s*\(/gi)) {
    const nombre = m[1].toLowerCase();
    if (!FUNCIONES.has(nombre) && !permitidas.has(nombre)) return false;
  }
  for (const m of codigo.matchAll(/''\s+(?:as\s+\w+|(\w+))/gi)) {
    if (!m[1] || !TRAS_LITERAL.has(m[1].toLowerCase())) return false;
  }
  return true;
}

/** La sentencia limpia si es aceptable (un solo SELECT/WITH de solo lectura), o `null`. */
export function validarSelect(bruto: string): string | null {
  let sql = bruto.trim().replace(/^```(?:sql)?/i, "").replace(/```$/, "").trim().replace(/;\s*$/, "").trim();
  if (!sql || sql.length > MAX_LARGO_SQL) return null;
  // Sin barra invertida ni en los textos: `E'\\''` desincroniza dónde acaba un literal y escondería código fuera de esta revisión.
  if (sql.includes("\\")) return null;
  if (!/^(select|with)\b/i.test(sql)) return null;
  const codigo = sinLiterales(sql);
  if (codigo.includes(";")) return null;
  if (PROHIBIDAS.test(codigo)) return null;
  // Una CTE propia no puede ocultar las tablas preparadas.
  if (/\b(notas|cifras)\s+as\s*\(/i.test(codigo)) return null;
  if (!soloFuentesPermitidas(codigo)) return null;
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

const PIDE_ORDEN = /\b(mayor|menor|m[aá]s|menos|alto|alta|bajo|baja|primer|primero|ranking|compar\w*)\b/i;

/** Sin un orden pedido («el país más caro»), la cifra de Colombia o la nacional va primero: este es un medio colombiano y la primera fila es la respuesta. */
export function colombiaPrimero<T extends Record<string, unknown>>(filas: T[], pregunta: string): T[] {
  if (PIDE_ORDEN.test(pregunta)) return filas;
  const propia = (f: T) => /^(colombia|total nacional|nacional)\b/i.test(String(f.serie ?? ""));
  return [...filas.filter(propia), ...filas.filter((f) => !propia(f))];
}
