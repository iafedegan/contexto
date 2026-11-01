/**
 * Lo que el asistente nunca contesta: cómo está hecho el sitio. Se decide sin IA, antes de buscar nada, para que ningún modelo llegue a leer la pregunta.
 * Es la primera barrera; la que protege los datos de verdad es `validarSelect`, que no deja leer nada fuera de las notas y las cifras.
 * Los patrones son concretos a propósito: «puntos clave del gremio» o «columnas de opinión» son preguntas normales.
 */
export const RESPUESTA_SISTEMA = "Solo puedo ayudarte con noticias y cifras del sector ganadero. No doy información sobre el funcionamiento de este sitio.";

const PATRONES: RegExp[] = [
  // Claves y secretos.
  /contrasen|password|passwd|credencial|api[ _-]?keys?|\btokens?\b|\bjwt\b|\bsecrets?\b|\.env\b|variables? de entorno|hash(es)? de/,
  /\bclaves?\s+(de\s+|del\s+|de la\s+)?(api|acceso|admin\w*|root|sistema|servidor|base|panel|sitio|supabase|openai|gemini|secretas?)\b|\b(tus|sus)\s+claves\b|\b(dame|dime|pasame|muestra\w*|revela\w*)\s+(las\s+)?claves\b/,
  /secreto(s)?\s+(del|de la|de)\s+(sistema|servidor|sitio|panel|base)/,
  // Base de datos y código, salvo las de otras entidades del sector.
  /\bbases? de datos\b(?!\s+(del?|de la)\s+(ica|dane|sinigan|fedegan|upra|agrosavia|ganaderos|predios))/,
  /\b(supabase|postgres\w*|pgvector|mysql|mongodb|vercel|drizzle|next\.?js|inngest|sql|backend|frontend|github)\b|information_schema|\bpg_\w+|\bschema\b/,
  /\bselect\b.+\bfrom\b|\b(drop|truncate)\s+table\b|\bque tablas\b|\bcuales tablas\b|\btablas? (de|del|en) (la base|el sistema|el sitio)\b|columnas de la tabla|\besquema de la\b/,
  /\bservidor(es)?\s+(del|de la|donde)\b|\bhosting\b|codigo fuente|\brepositorio\b|\bendpoints?\b|\b(tu|su|la) api\b|direccion ip/,
  // Personas con cuenta.
  /\b(correos?|emails?|lista|listado|datos|nombres?)\s+de\s+(los\s+|las\s+)?(usuarios|administradores|admins?|editores|redactores|suscriptores)\b|usuarios registrados|\b(quien|quienes) (es|son) (el|los) admin/,
  // El propio asistente y los intentos de cambiarle las reglas.
  /\b(ignora|olvida|omite|salta\w*)\b.{0,30}\b(instrucciones|reglas|indicaciones)\b|\b(tus|sus) (instrucciones|reglas)\b|instrucciones (del sistema|internas|iniciales)|\bprompts?\b|system message|jailbreak/,
  /\bmodo (admin\w*|desarrollador|developer|dios|dan|depuracion|debug)\b|\b(actua|haz|hazte pasar) como\b|\bact as\b|\beres ahora\b/,
  /\b(quien|que empresa) te (creo|hizo|programo|entreno)\b|\bcomo (funcionas|estas hecho|fuiste|te programaron)\b|\bque (modelo( de (ia|inteligencia artificial|lenguaje))?|ia|inteligencia artificial) (eres|usas|utilizas)\b|\b(openai|anthropic|chatgpt|claude|gemini)\b/,
];

export function preguntaSobreSistema(pregunta: string): boolean {
  const texto = pregunta.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ");
  return PATRONES.some((p) => p.test(texto));
}
