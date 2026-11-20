import sharp from "sharp";
import { descargarSeguro } from "@/lib/safe-fetch";
import { siteUrl } from "@/lib/utils";

/**
 * Imagen para la vista previa al compartir una nota (WhatsApp, Facebook, X, LinkedIn): la portada recortada a 1200 × 630 y en JPEG liviano.
 * WhatsApp no muestra la vista previa si la imagen pasa de ~600 KB, y muchas portadas nuevas son PNG de 1-3 MB: por eso los enlaces dejaron de
 * verse con foto. Solo acepta imágenes de los orígenes del propio sitio (almacenamiento de Supabase, Storyblok, YouTube y el dominio del sitio),
 * para no servir de proxy de imágenes ajenas. La respuesta queda en la caché de la red de Vercel por un año (la URL depende de la imagen).
 */
export const runtime = "nodejs";

const ANCHO = 1200;
const ALTO = 630;

function origenPermitido(u: URL): boolean {
  if (u.protocol !== "https:") return false;
  const supabase = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).host : "";
  const sitio = new URL(siteUrl("/")).host.replace(/^www\./, "");
  const host = u.host.replace(/^www\./, "");
  return host === sitio || (supabase !== "" && u.host === supabase) || u.host.endsWith(".supabase.co") || u.host === "a.storyblok.com" || u.host === "i.ytimg.com";
}

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u") ?? "";
  let destino: URL;
  try {
    destino = new URL(u);
  } catch {
    return new Response("imagen no válida", { status: 400 });
  }
  if (!origenPermitido(destino)) return new Response("origen no permitido", { status: 400 });
  try {
    const r = await descargarSeguro(destino, { maxBytes: 15_000_000, codificacion: "latin1", plazoMs: 15_000 });
    if (!r || r.status !== 200 || !r.tipo.startsWith("image/")) return Response.redirect(destino.toString(), 302);
    const jpeg = await sharp(Buffer.from(r.cuerpo, "latin1"), { failOn: "none" })
      .rotate()
      .resize({ width: ANCHO, height: ALTO, fit: "cover", position: "attention" })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    return new Response(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch {
    // Si no se puede procesar, la vista previa usa la imagen original (mejor eso que nada).
    return Response.redirect(destino.toString(), 302);
  }
}
