/**
 * Catálogo de proveedores de modelo. SIN `server-only` a propósito: son datos
 * y tipos que también necesita el formulario del panel, que es cliente.
 *
 * La resolución de claves y la creación del modelo viven en
 * `src/lib/ai-provider.ts`, que sí es de servidor (toca base de datos y
 * criptografía). Mezclarlos arrastraba el cliente de Postgres al navegador.
 */
export const AI_PROVIDERS = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    envVar: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-5",
    /** Prefijo habitual, solo informativo: la validación real la hace el proveedor. */
    keyHint: "sk-ant-",
    docs: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "google",
    label: "Google (Gemini)",
    envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    defaultModel: "",
    keyHint: "AIza",
    docs: "https://aistudio.google.com/app/apikey",
  },
] as const;

// Identificador de proveedor de IA: cualquiera de los de la lista AI_PROVIDERS.
export type AiProviderId = (typeof AI_PROVIDERS)[number]["id"];

// Ajustes de IA guardados: proveedor activo, modelos y claves cifradas por proveedor.
export type AiSettings = {
  provider: AiProviderId;
  model: string;
  /** Modelo de Gemini para las gráficas con búsqueda en Google; vacío = el principal. */
  chartModel?: string;
  /** Claves cifradas, una por proveedor. */
  keys: Partial<Record<AiProviderId, string>>;
  /**
   * Modelos que el proveedor listó la última vez que se validó la clave.
   * Se guardan para poder ofrecer un desplegable real en vez de un nombre
   * escrito a mano que puede quedar obsoleto (los catálogos cambian).
   */
  models?: Partial<Record<AiProviderId, string[]>>;
};

// Estado de una clave para la pantalla de Configuración: sin revelarla, solo si existe y qué modelos permite.
export type KeyStatus = {
  provider: AiProviderId;
  model: string;
  chartModel: string;
  /** Catálogo real de la cuenta; vacío si aún no se ha validado la clave. */
  models: string[];
  present: boolean;
  source: "entorno" | "panel" | null;
  /** Máscara para reconocerla: nunca la clave completa. */
  masked: string | null;
};

// Ajustes iniciales: Anthropic con su modelo por defecto y ninguna clave.
export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "anthropic",
  model: "claude-sonnet-5",
  keys: {},
  models: {},
};

// Datos de un proveedor por su id; si no existe, el primero de la lista.
export function providerMeta(id: AiProviderId) {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];
}
