"use server";

/**
 * Subida de medios del panel editorial.
 *
 * Va a Supabase Storage (bucket público "media") vía su API REST, sin el SDK
 * `@supabase/supabase-js`, para no sumar una dependencia nueva solo por esto.
 * En Vercel el disco es efímero — `public/subidas/` nunca sobrevivía a una
 * segunda petición, así que la imagen "se subía" pero desaparecía enseguida.
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { chartProblem, renderChartSvg } from "@/lib/chart-svg";

const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

/** 25 MB: suficiente para una foto de portada o un clip corto. */
const MAX_BYTES = 25 * 1024 * 1024;

const BUCKET = "media";

export type UploadResult =
  | { ok: true; url: string; kind: "imagen" | "video" }
  | { ok: false; error: string };

export async function uploadMedia(formData: FormData): Promise<UploadResult> {
  await requireRole("redactor");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No llegó ningún archivo." };
  }

  const ext = TIPOS[file.type];
  if (!ext) {
    return {
      ok: false,
      error: `Formato no admitido (${file.type || "desconocido"}). Usa JPG, PNG, WebP, AVIF, GIF, MP4 o WebM.`,
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo son 25 MB.`,
    };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return {
      ok: false,
      error: "Falta configurar SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el servidor.",
    };
  }

  const name = `${randomUUID()}.${ext}`;
  const res = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": file.type,
      "x-upsert": "false",
    },
    body: Buffer.from(await file.arrayBuffer()),
  });

  if (!res.ok) {
    return { ok: false, error: `No se pudo subir el archivo a Supabase (${res.status}).` };
  }

  return {
    ok: true,
    url: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${name}`,
    kind: file.type.startsWith("video/") ? "video" : "imagen",
  };
}

const chartSpecSchema = z.object({
  type: z.enum(["bar", "line", "pie"]),
  title: z.string().max(90),
  unit: z.string().max(60),
  labels: z.array(z.string().max(40)).max(12),
  series: z.array(z.object({ name: z.string().max(40), values: z.array(z.number()) })).max(4),
});

/**
 * Sube una gráfica a Storage. Recibe los DATOS, no un SVG: el servidor la
 * vuelve a dibujar (y valida) para no publicar nunca un SVG enviado por el cliente.
 */
export async function saveChartImage(spec: unknown): Promise<UploadResult> {
  await requireRole("redactor");
  const parsed = chartSpecSchema.safeParse(spec);
  if (!parsed.success) return { ok: false, error: "Datos de gráfica inválidos." };
  const problem = chartProblem(parsed.data);
  if (problem) return { ok: false, error: problem };

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: "Falta configurar SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el servidor." };
  }
  const name = `grafica-${randomUUID()}.svg`;
  const res = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "image/svg+xml", "x-upsert": "false" },
    body: renderChartSvg(parsed.data),
  });
  if (!res.ok) return { ok: false, error: `No se pudo subir la gráfica a Supabase (${res.status}).` };
  return { ok: true, url: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${name}`, kind: "imagen" };
}
