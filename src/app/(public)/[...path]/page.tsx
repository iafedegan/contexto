import { notFound, permanentRedirect, redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { redirects } from "@/db/schema";

/**
 * Catch-all de baja prioridad. Resuelve las redirecciones 301 uno-a-uno de la
 * tabla `redirects` (las de taxonomía completa las hace el middleware).
 * Si no hay coincidencia -> 404.
 *
 * NOTA: los artículos del archivo histórico NO llegan aquí: viven en el dominio
 * legado con sus rutas originales y nunca se enrutan por el portal nuevo.
 */
export const dynamic = "force-dynamic";

// Rutas que no existen: aplica las redirecciones antiguas (taxonomía legada y tabla redirects) o responde 404.
export default async function CatchAll({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const fromPath = "/" + path.join("/");

  let row: { toPath: string; statusCode: number } | undefined;
  try {
    [row] = await db
      .select({ toPath: redirects.toPath, statusCode: redirects.statusCode })
      .from(redirects)
      .where(eq(redirects.fromPath, fromPath))
      .limit(1);
  } catch {
    row = undefined;
  }

  if (!row) notFound();

  // Métrica de seguimiento para Search Console / analítica interna.
  db.update(redirects)
    .set({ hits: sql`${redirects.hits} + 1` })
    .where(eq(redirects.fromPath, fromPath))
    .catch(() => {});

  if (row.statusCode === 301) permanentRedirect(row.toPath);
  redirect(row.toPath);
}
