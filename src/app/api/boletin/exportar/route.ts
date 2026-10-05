import { desc } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";

/** CSV de suscriptores (solo editores). Neutraliza fórmulas para que Excel no las ejecute. */
export async function GET() {
  await requirePermiso("newsletter");
  const rows = await db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt));
  // Celda CSV entre comillas; si parece una fórmula, antepone un apóstrofo.
  const cell = (v: string) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  const csv = ["correo,estado,alta", ...rows.map((r) => [cell(r.email), r.unsubscribedAt ? "baja" : r.confirmed ? "activo" : "pendiente", r.createdAt.toISOString()].join(","))].join("\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="suscriptores.csv"', "cache-control": "no-store" } });
}
