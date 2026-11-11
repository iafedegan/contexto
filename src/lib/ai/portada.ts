import "server-only";

import { generateImage, generateText } from "ai";
import { getAiModel, getImageAi } from "@/lib/ai-provider";
import { subirImagenBytes } from "@/lib/media-upload";
import { PREFIJO_IMAGEN_IA } from "@/lib/ai-image";
import { registrarCostoIA, registrarUsoIA, verificarCuotaIA } from "@/lib/ai-cuota";
import { aWebp } from "@/lib/imagen-webp";
import { construirPrompt, type EstiloEscena } from "@/lib/ai/prompt-escena";

// Resultado de generar la portada: dirección de la imagen, texto alternativo y escena usada, o un error.
export type CoverImageResult =
  | { ok: true; url: string; alt: string; scene: string }
  | { ok: false; error: string };

/**
 * Genera la portada a partir del tema de la nota: primero el modelo de texto redacta la escena (fotográfica, sin texto, sin personas reales
 * identificables) y luego el modelo de imagen la pinta en 16:9 con la dirección de arte elegida (tratamiento, cámara, plano, luz y ambiente, ensamblados
 * en un prompt profesional por `construirPrompt`). Puede devolver varias opciones para elegir. Cada una se convierte a WebP 16:9 de peso liviano y se
 * sube al mismo almacenamiento que las fotos, etiquetada como generada con IA.
 */
export type PortadasResult =
  | { ok: true; imagenes: { url: string }[]; alt: string; scene: string; prompt: string }
  | { ok: false; error: string };

export type EntradaPortada = {
  title: string;
  excerpt?: string;
  section?: string;
  /** Cuerpo de la nota (HTML o texto): la escena sale de lo que la nota realmente cuenta. */
  body?: string;
  /** Escena escrita por el periodista (opcional): manda sobre la que propondría el modelo. */
  scene?: string;
  /** Modelo de imagen preferido (p. ej. Nano Banana Pro); si no está disponible se cae al elegido en Configuración y luego al de 1K. */
  modelo?: string;
  /** Dirección de arte (tratamiento, cámara, plano, luz, ambiente y notas). Sin ella, el estilo de siempre. */
  estilo?: Partial<EstiloEscena>;
  /** Cuántas opciones generar (1 a 4). */
  cantidad?: number;
};

export async function generarPortadasCore(userId: string, input: EntradaPortada): Promise<PortadasResult> {
  const title = input.title.trim();
  if (title.length < 5 && !(input.scene ?? "").trim()) {
    return { ok: false, error: "Escribe primero el título de la nota (o describe la escena) para generar la imagen." };
  }
  const imageModel = await getImageAi();
  if (!imageModel) return { ok: false, error: "Falta la clave del modelo (la conecta un administrador en Configuración → Inteligencia artificial)." };
  if (imageModel === "otro-proveedor") {
    return { ok: false, error: "Las imágenes se generan con Gemini: pídele a un administrador que elija Google (Gemini) en Configuración → Inteligencia artificial." };
  }
  const cantidad = Math.min(4, Math.max(1, Math.round(input.cantidad ?? 1)));
  const text = await getAiModel();
  try {
    const cuota = await verificarCuotaIA(userId);
    if (!cuota.ok) return { ok: false, error: cuota.message };

    let scene = (input.scene ?? "").trim();
    if (!scene && text) {
      const r = await generateText({
        model: text,
        system:
          "Eres director de fotografía de un medio periodístico colombiano. Escribes UNA escena fotográfica concreta, en español, de 1-2 frases, que ilustre EXACTAMENTE lo que cuenta la noticia: su hecho central, los sujetos que nombra (animales, cultivos, personas en su oficio, instalaciones, mercados), el lugar y la situación. REGLA 1 (la más importante): fidelidad al tema. La imagen muestra el sujeto real de la nota y nunca otro: una nota sobre elefantes muestra elefantes; sobre sequía, potreros resecos; sobre exportación de carne, corrales o embarque; sobre precios, subasta o feria ganadera; sobre café, cafetales; sobre una enfermedad, la situación sanitaria del animal afectado. Prohibido sustituir el sujeto por ganado, campesinos o paisajes genéricos si la nota trata de otra cosa, y prohibido escenas que servirían para cualquier nota. REGLA 2 (ámbito): si la noticia ocurre en Colombia o trata del sector agropecuario colombiano, ambienta la escena en Colombia (Llanos Orientales, sabana de Córdoba y Sucre, montaña andina, valles del Cauca, páramo, Caribe) y, si aparecen personas, que sean campesinos y ganaderos colombianos anónimos (sombrero aguadeño o de paja, ruana o poncho, botas de caucho), de espaldas o a distancia, con ganado propio del trópico colombiano (cebú, brahman, criollo). Si la noticia ocurre en otro país o trata de otra especie o tema (por ejemplo elefantes en África o Asia, mercados internacionales), ilustra ese entorno real (sabana africana, bosque asiático, puerto, bolsa…) tal como es, sin forzar elementos colombianos que no pertenecen. Si el tema es abstracto (cifras, política pública), usa un símbolo visual concreto del tema (documentos, instalaciones, el producto) y no una escena de campo genérica. Sin texto en la imagen. NUNCA retrates a una persona real identificable (políticos, empresarios, figuras públicas): usa personas anónimas de espaldas, siluetas o planos generales. Sin logotipos ni marcas. Responde SOLO con la escena, sin explicaciones.",
        prompt: `TÍTULO: ${title}\n${input.excerpt ? `RESUMEN: ${input.excerpt.slice(0, 400)}\n` : ""}${input.section ? `SECCIÓN: ${input.section}\n` : ""}${input.body ? `CONTENIDO DE LA NOTA:\n${input.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1800)}\n` : ""}\nDescribe la escena que mejor ilustra el hecho central de esta nota.`,
      });
      await registrarUsoIA(userId, r.usage);
      scene = r.text.trim().replace(/^["«]|["»]$/g, "");
    }
    if (!scene) scene = `Escena fotográfica que ilustra fielmente el tema: ${title}`;

    const prompt = construirPrompt({ titulo: title, resumen: input.excerpt, escena: scene, estilo: input.estilo });

    // Una imagen: primero el modelo preferido (si se pidió uno) en 2K; si falla, el elegido en Configuración y, como último recurso, el de 1K.
    let costoUnitario = COSTO_IMAGEN_USD;
    const una = async (): Promise<Uint8Array> => {
      const preferido = input.modelo ? await getImageAi(input.modelo) : null;
      if (preferido && preferido !== "otro-proveedor") {
        try {
          const { image } = await generateImage({ model: preferido, prompt, aspectRatio: "16:9", providerOptions: { google: { imageConfig: { imageSize: "2K" } } } });
          costoUnitario = COSTO_IMAGEN_PRO_USD;
          return image.uint8Array;
        } catch (e) {
          console.warn("generarPortadas: falló el modelo preferido, uso el de Configuración:", e);
        }
      }
      try {
        const { image } = await generateImage({ model: imageModel, prompt, aspectRatio: "16:9", providerOptions: { google: { imageConfig: { imageSize: "2K" } } } });
        return image.uint8Array;
      } catch (e) {
        console.warn("generarPortadas: falló el modelo de 2K, uso el de 1K:", e);
        const respaldo = await getImageAi("gemini-2.5-flash-image");
        if (!respaldo || respaldo === "otro-proveedor") throw e;
        const { image } = await generateImage({ model: respaldo, prompt, aspectRatio: "16:9" });
        return image.uint8Array;
      }
    };
    // Las opciones se piden a la vez; si alguna falla, se entregan las que salieron.
    const resultados = await Promise.allSettled(Array.from({ length: cantidad }, () => una()));
    const hechas = resultados.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (!hechas.length) {
      const primero = resultados.find((r): r is PromiseRejectedResult => r.status === "rejected");
      throw primero?.reason ?? new Error("El modelo de imagen no respondió.");
    }
    await registrarCostoIA(userId, costoUnitario * hechas.length);

    // Cada opción queda lista para publicar: WebP, 16:9 exacto, ≥ 1200 px de ancho y de peso liviano. El tipo lo decide la firma de los bytes (H-22).
    const imagenes: { url: string }[] = [];
    for (const bytes of hechas) {
      const lista = await aWebp(bytes);
      const up = await subirImagenBytes(lista.bytes);
      if (!up.ok) return { ok: false, error: up.error };
      imagenes.push({ url: up.url });
    }
    return { ok: true, imagenes, alt: `${PREFIJO_IMAGEN_IA} ${scene}`.slice(0, 300), scene, prompt };
  } catch (err) {
    console.error("generarPortadas:", err);
    const detalle = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: detalle ? `No se pudo generar la imagen: ${detalle.slice(0, 220)}` : "El modelo de imagen no respondió." };
  }
}

/** Una sola portada (el asistente de redacción, Telegram y el consejo de redacción): lo mismo que `generarPortadasCore` con una opción. */
export async function generateCoverImageCore(
  userId: string,
  input: Omit<EntradaPortada, "cantidad">,
): Promise<CoverImageResult> {
  const r = await generarPortadasCore(userId, { ...input, cantidad: 1 });
  return r.ok ? { ok: true, url: r.imagenes[0].url, alt: r.alt, scene: r.scene } : r;
}

/* --------------------------------------------------------------------------
 * Material de partida: entrevista de voz transcrita y enlaces leídos
 * -------------------------------------------------------------------------- */

/** Costo estimado por imagen generada (USD); se descuenta de la cuota mensual de la persona. */
export const COSTO_IMAGEN_USD = 0.12;

/** Nano Banana Pro (Gemini 3 Pro Image): el modelo de imagen de mayor calidad de Gemini; cuesta más por imagen en 2K. */
export const MODELO_IMAGEN_PRO = "gemini-3-pro-image-preview";
export const COSTO_IMAGEN_PRO_USD = 0.14;
