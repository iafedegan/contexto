import "server-only";

import { generateImage, generateText } from "ai";
import { getAiModel, getImageAi } from "@/lib/ai-provider";
import { subirImagenBytes } from "@/lib/media-upload";
import { PREFIJO_IMAGEN_IA } from "@/lib/ai-image";
import { registrarCostoIA, registrarUsoIA, verificarCuotaIA } from "@/lib/ai-cuota";

// Resultado de generar la portada: dirección de la imagen, texto alternativo y escena usada, o un error.
export type CoverImageResult =
  | { ok: true; url: string; alt: string; scene: string }
  | { ok: false; error: string };

/**
 * Genera la portada a partir del tema de la nota: primero el modelo de texto redacta la escena
 * (fotográfica, sin texto, sin personas reales identificables) y luego el modelo de imagen la pinta
 * en 16:9. Se sube al mismo almacenamiento que las fotos y se etiqueta como generada con IA.
 */
export async function generateCoverImageCore(userId: string, input: {
  title: string;
  excerpt?: string;
  section?: string;
  /** Cuerpo de la nota (HTML o texto): la escena sale de lo que la nota realmente cuenta. */
  body?: string;
  /** Escena escrita por el periodista (opcional): manda sobre la que propondría el modelo. */
  scene?: string;
}): Promise<CoverImageResult> {
  const title = input.title.trim();
  if (title.length < 5 && !(input.scene ?? "").trim()) {
    return { ok: false, error: "Escribe primero el título de la nota (o describe la escena) para generar la imagen." };
  }
  const imageModel = await getImageAi();
  if (!imageModel) return { ok: false, error: "Falta la clave del modelo (Configuración → Asistente)." };
  if (imageModel === "otro-proveedor") {
    return { ok: false, error: "Las imágenes se generan con Gemini: elige Google (Gemini) en Configuración → Asistente." };
  }
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

    const prompt =
      `Fotografía fotorrealista con estética de fotograma de cine que ilustra la noticia «${title}»${input.excerpt ? ` (${input.excerpt.slice(0, 220)})` : ""}. La imagen debe mostrar de forma inequívoca el tema de la nota, no una escena genérica: ${scene}. ` +
      "Máxima nitidez y detalle, resolución muy alta, sin compresión ni pixelado. Iluminación natural cinematográfica (luz dorada o contraluz suave), lente anamórfica de 35 mm, poca profundidad de campo, " +
      "grano de película sutil, colores naturales y ricos, composición editorial amplia en formato horizontal 16:9. " +
      "Muestra únicamente lo que describe la escena y nada más: no agregues animales, personas, paisajes ni elementos que la escena no mencione. " +
      "Sin texto, sin letras, sin logotipos, sin marcas de agua. Sin personas reales identificables.";

    // Alta resolución (2K ≈ 2752×1536): a pantalla completa una imagen de 1K se pixela. Si el modelo
    // de 2K no está disponible, se cae al anterior (1K) en vez de fallar.
    let image;
    try {
      ({ image } = await generateImage({
        model: imageModel,
        prompt,
        aspectRatio: "16:9",
        providerOptions: { google: { imageConfig: { imageSize: "2K" } } },
      }));
    } catch (e) {
      console.warn("generateCoverImage: falló el modelo de 2K, uso el de 1K:", e);
      const respaldo = await getImageAi("gemini-2.5-flash-image");
      if (!respaldo || respaldo === "otro-proveedor") throw e;
      ({ image } = await generateImage({ model: respaldo, prompt, aspectRatio: "16:9" }));
    }
    await registrarCostoIA(userId, COSTO_IMAGEN_USD);
    const mime = image.mediaType === "image/jpeg" ? "image/jpeg" : image.mediaType === "image/webp" ? "image/webp" : "image/png";
    const up = await subirImagenBytes(image.uint8Array, mime);
    if (!up.ok) return { ok: false, error: up.error };
    return { ok: true, url: up.url, alt: `${PREFIJO_IMAGEN_IA} ${scene}`.slice(0, 300), scene };
  } catch (err) {
    console.error("generateCoverImage:", err);
    const detalle = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: detalle ? `No se pudo generar la imagen: ${detalle.slice(0, 220)}` : "El modelo de imagen no respondió." };
  }
}

/* --------------------------------------------------------------------------
 * Material de partida: entrevista de voz transcrita y enlaces leídos
 * -------------------------------------------------------------------------- */

/** Costo estimado por imagen generada (USD); se descuenta de la cuota mensual de la persona. */
export const COSTO_IMAGEN_USD = 0.12;
