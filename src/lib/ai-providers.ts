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
    id: "openai",
    label: "OpenAI (ChatGPT)",
    envVar: "OPENAI_API_KEY",
    defaultModel: "gpt-5",
    keyHint: "sk-",
    docs: "https://platform.openai.com/api-keys",
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
  /** Modelo de Gemini que genera las imágenes de portada; vacío = `DEFAULT_IMAGE_MODEL`. */
  imageModel?: string;
  /** Claves cifradas, una por proveedor. */
  keys: Partial<Record<AiProviderId, string>>;
  /** Modelo propio por función (editores, agente de la vaca, imágenes, videos). Vacío = todo usa el modelo principal de arriba. */
  roles?: AiRoles;
  /**
   * Modelos que el proveedor listó la última vez que se validó la clave.
   * Se guardan para poder ofrecer un desplegable real en vez de un nombre
   * escrito a mano que puede quedar obsoleto (los catálogos cambian).
   */
  models?: Partial<Record<AiProviderId, string[]>>;
};

/**
 * Un modelo se identifica como «proveedor:modelo» (p. ej. `google:gemini-3.8-flash`): así una función puede usar Gemini y otra Claude. Los ajustes
 * viejos (`provider` + `model`) siguen valiendo como «modelo principal».
 */
export type ModeloRef = string;

/** Funciones de IA que tienen modelo propio. */
export type RolIA = "editor" | "asistente" | "busqueda" | "imagen" | "videoEntender" | "videoGenerar";

/** Modelo por función. `editor` es una LISTA: el administrador habilita varios y quien crea la nota elige cuál usar. */
export type AiRoles = {
  editor?: { habilitados: ModeloRef[]; predeterminado?: ModeloRef };
  /** Agente de la vaca: el asistente público del sitio. */
  asistente?: ModeloRef;
  /** Modelo BARATO que traduce la pregunta a términos de búsqueda antes de buscar (ver `expandirConsulta`). Vacío = el más barato de la cuenta. */
  busqueda?: ModeloRef;
  /** Fotos de portada (solo Gemini). */
  imagen?: ModeloRef;
  /** Leer y transcribir videos que sube el editor (solo Gemini). */
  videoEntender?: ModeloRef;
  /** Generar videos con IA (solo Gemini/Veo). */
  videoGenerar?: ModeloRef;
};

export const refModelo = (provider: AiProviderId, modelo: string): ModeloRef => `${provider}:${modelo}`;

/** Separa «proveedor:modelo». `null` si no tiene esa forma o el proveedor no existe. */
export function leerRef(ref: string | undefined | null): { provider: AiProviderId; model: string } | null {
  const i = (ref ?? "").indexOf(":");
  if (i < 1) return null;
  const provider = ref!.slice(0, i) as AiProviderId;
  const model = ref!.slice(i + 1).trim();
  return AI_PROVIDERS.some((p) => p.id === provider) && model ? { provider, model } : null;
}

/** ¿Es un modelo que genera video (familia Veo)? */
export function esModeloDeVideo(nombre: string): boolean {
  return /veo/i.test(nombre);
}

/** ¿Sirve para escribir y razonar con texto? Excluye los de imagen, video, voz y vectores. */
export function esModeloDeTexto(nombre: string): boolean {
  // OpenAI lista en el mismo catálogo voz, imágenes, moderación y modelos viejos de completado: de ahí solo sirven los de chat (gpt-…, o1/o3/o4…).
  if (/^(gpt|o\d|chatgpt)/i.test(nombre) && /image|audio|realtime|transcribe|tts|search|instruct|codex|moderation|embed/i.test(nombre)) return false;
  if (/^(whisper|dall-e|davinci|babbage|text-|omni-moderation|sora)/i.test(nombre)) return false;
  return !esModeloDeImagen(nombre) && !esModeloDeVideo(nombre) && !/embed|tts|aqa|imagen-|live|audio|robotics|computer-use/i.test(nombre);
}

/**
 * Qué modelo usa cada función, ya resuelto contra los ajustes. Puro (sin base de datos) para poder probarlo.
 * - editor: la lista habilitada (si no hay, solo el principal) y el predeterminado; `elegido` solo vale si está en la lista.
 * - asistente: el suyo o, si no hay, el principal.
 * - imagen: el suyo, el viejo `imageModel` o el modelo de imagen por defecto (siempre Gemini).
 * - videoEntender: el suyo o, si el principal es Gemini, el principal.
 * - videoGenerar: solo si se eligió uno.
 */
export function modeloDe(settings: AiSettings, rol: RolIA, elegido?: string | null): ModeloRef | null {
  const principal = refModelo(settings.provider, settings.model);
  const r = settings.roles ?? {};
  switch (rol) {
    case "editor": {
      const lista = listaEditor(settings);
      return elegido && lista.habilitados.includes(elegido) ? elegido : lista.predeterminado;
    }
    case "asistente":
      return r.asistente || principal;
    case "busqueda":
      return r.busqueda || modeloBarato(settings.models) || r.asistente || principal;
    case "imagen":
      return r.imagen || refModelo("google", settings.imageModel || DEFAULT_IMAGE_MODEL);
    case "videoEntender":
      return r.videoEntender || (settings.provider === "google" ? principal : null);
    case "videoGenerar":
      return r.videoGenerar || null;
  }
}

/**
 * El modelo más barato disponible para tareas cortas (traducir la pregunta a términos de búsqueda): por proveedor prefiere la línea «lite»/«nano»/
 * «mini»/«haiku» y, si no hay, la «flash». Recorre Gemini, ChatGPT y Claude en ese orden; `null` si no hay catálogo de ninguno.
 */
export function modeloBarato(modelos: Partial<Record<AiProviderId, string[]>> | undefined): ModeloRef | null {
  const reglas: [AiProviderId, RegExp[]][] = [
    ["google", [/flash-lite/i, /flash(?!.*(image|live|tts))/i]],
    ["openai", [/nano/i, /mini/i]],
    ["anthropic", [/haiku/i]],
  ];
  for (const [proveedor, patrones] of reglas) {
    const catalogo = (modelos?.[proveedor] ?? []).filter(esModeloDeTexto);
    for (const patron of patrones) {
      // Entre varios, el de nombre más corto suele ser la versión estable (sin «preview» ni fechas).
      const candidato = catalogo.filter((m) => patron.test(m) && !/preview|exp|latest/i.test(m)).sort((a, b) => a.length - b.length)[0] ?? catalogo.filter((m) => patron.test(m)).sort((a, b) => a.length - b.length)[0];
      if (candidato) return refModelo(proveedor, candidato);
    }
  }
  return null;
}

/** Los modelos que un editor puede elegir al crear una nota, y el que va marcado de entrada. Nunca vacía. */
export function listaEditor(settings: AiSettings): { habilitados: ModeloRef[]; predeterminado: ModeloRef } {
  const principal = refModelo(settings.provider, settings.model);
  const e = settings.roles?.editor;
  const habilitados = [...new Set((e?.habilitados ?? []).filter((x) => leerRef(x)))];
  if (habilitados.length === 0) return { habilitados: [principal], predeterminado: principal };
  return { habilitados, predeterminado: e?.predeterminado && habilitados.includes(e.predeterminado) ? e.predeterminado : habilitados[0] };
}

// Estado de una clave para la pantalla de Configuración: sin revelarla, solo si existe y qué modelos permite.
export type KeyStatus = {
  provider: AiProviderId;
  model: string;
  chartModel: string;
  imageModel: string;
  /** Catálogo real de la cuenta; vacío si aún no se ha validado la clave. */
  models: string[];
  present: boolean;
  source: "entorno" | "panel" | null;
  /** Máscara para reconocerla: nunca la clave completa. */
  masked: string | null;
};

/** Modelo de imagen que se usa mientras no se elija otro en Configuración (Gemini «nano banana», admite 2K). */
export const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

/** ¿Es un modelo que genera imágenes? Se reconoce por el nombre del catálogo («…-image…», «nano-banana…»). */
export function esModeloDeImagen(nombre: string): boolean {
  return /image|banana/i.test(nombre);
}

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
