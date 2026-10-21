import { esModeloDeImagen, esModeloDeTexto, esModeloDeVideo, leerRef, refModelo, type AiProviderId, type AiRoles, type AiSettings } from "@/lib/ai-providers";

/**
 * Valida y normaliza los modelos por función que llegan del formulario, contra lo que cada proveedor ofrece de verdad (catálogo guardado al validar
 * su clave) y contra qué proveedores tienen clave. Puro: no toca la base de datos. Devuelve los roles listos para guardar o un mensaje claro.
 */
export function validarRoles(
  entrada: unknown,
  catalogos: Partial<Record<AiProviderId, string[]>>,
  conClave: AiProviderId[],
): { ok: true; roles: AiRoles; principal: { provider: AiProviderId; model: string } } | { ok: false; error: string } {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  // Comprueba UNA referencia «proveedor:modelo»: forma, clave del proveedor, que el modelo exista en su catálogo y que sea del tipo pedido.
  const revisar = (ref: string, etiqueta: string, tipo: "texto" | "imagen" | "video" | "gemini-texto"): string | null => {
    const r = leerRef(ref);
    if (!r) return `${etiqueta}: modelo no válido.`;
    if (!conClave.includes(r.provider)) return `${etiqueta}: falta la clave de ${r.provider === "google" ? "Google (Gemini)" : "Anthropic (Claude)"}. Guárdala primero en «Claves».`;
    const cat = catalogos[r.provider] ?? [];
    if (cat.length > 0 && !cat.includes(r.model)) return `${etiqueta}: tu cuenta no ofrece «${r.model}».`;
    if (tipo === "imagen" && (r.provider !== "google" || !esModeloDeImagen(r.model))) return `${etiqueta}: elige un modelo de imagen de Gemini.`;
    if (tipo === "video" && (r.provider !== "google" || !esModeloDeVideo(r.model))) return `${etiqueta}: elige un modelo de video de Gemini (Veo).`;
    if (tipo === "gemini-texto" && (r.provider !== "google" || !esModeloDeTexto(r.model))) return `${etiqueta}: elige un modelo de texto de Gemini (lee audio y video).`;
    if (tipo === "texto" && !esModeloDeTexto(r.model)) return `${etiqueta}: elige un modelo de texto, no de imagen o video.`;
    return null;
  };

  const habilitados = [...new Set((Array.isArray((e.editor as { habilitados?: unknown })?.habilitados) ? ((e.editor as { habilitados: unknown[] }).habilitados) : []).map(texto).filter(Boolean))];
  if (habilitados.length === 0) return { ok: false, error: "Los editores necesitan al menos un modelo habilitado." };
  if (habilitados.length > 8) return { ok: false, error: "Habilita como máximo 8 modelos para los editores." };
  for (const h of habilitados) {
    const mal = revisar(h, "Editores", "texto");
    if (mal) return { ok: false, error: mal };
  }
  const pred = texto((e.editor as { predeterminado?: unknown })?.predeterminado);
  const predeterminado = pred && habilitados.includes(pred) ? pred : habilitados[0];

  const roles: AiRoles = { editor: { habilitados, predeterminado } };
  const unicos: [keyof Omit<AiRoles, "editor">, string, "texto" | "imagen" | "video" | "gemini-texto"][] = [
    ["asistente", "Agente de la vaca", "texto"],
    ["imagen", "Imágenes", "imagen"],
    ["videoEntender", "Videos (entender)", "gemini-texto"],
    ["videoGenerar", "Videos (generar)", "video"],
  ];
  for (const [clave, etiqueta, tipo] of unicos) {
    const ref = texto(e[clave]);
    if (!ref) continue;
    const mal = revisar(ref, etiqueta, tipo);
    if (mal) return { ok: false, error: mal };
    roles[clave] = ref;
  }
  // El «modelo principal» de los ajustes viejos sigue el predeterminado de los editores: lo leen otras partes del sistema.
  const p = leerRef(predeterminado)!;
  return { ok: true, roles, principal: { provider: p.provider, model: p.model } };
}

/** Une la validación con los ajustes ya guardados: conserva claves, catálogos y el modelo de gráficas. */
export function aplicarRoles(actual: Partial<AiSettings>, v: { roles: AiRoles; principal: { provider: AiProviderId; model: string } }): AiSettings {
  return {
    provider: v.principal.provider,
    model: v.principal.model,
    ...(actual.chartModel ? { chartModel: actual.chartModel } : {}),
    ...(v.roles.imagen ? { imageModel: v.roles.imagen.slice(v.roles.imagen.indexOf(":") + 1) } : actual.imageModel ? { imageModel: actual.imageModel } : {}),
    roles: v.roles,
    keys: actual.keys ?? {},
    models: actual.models ?? {},
  };
}

export { refModelo };
