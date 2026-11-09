import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings, users } from "@/db/schema";
import type { PedidoImagen } from "@/lib/imagenes-pedidas-reglas";

/**
 * Imágenes que se le piden al diseñador. Se anotan en `site_settings` (una lista, un pedido por nota; sin migración), igual que las notas
 * asignadas a un editor. Cada escritura es una sola sentencia: dos pedidos a la vez no se pisan.
 */
export const IMAGENES_KEY = "imagenes_pedidas";

/** Todos los pedidos anotados. */
export async function leerPedidos(): Promise<PedidoImagen[]> {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, IMAGENES_KEY)).limit(1);
  return Array.isArray(row?.value) ? (row.value as PedidoImagen[]) : [];
}

/** Anota el pedido; si la nota ya tenía uno, lo reemplaza. */
export async function registrarPedido(p: PedidoImagen): Promise<void> {
  await db
    .insert(siteSettings)
    .values({ key: IMAGENES_KEY, value: [p] })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        value: sql`coalesce((select jsonb_agg(e) from jsonb_array_elements(${siteSettings.value}) e where e->>'articleId' <> ${p.articleId}), '[]'::jsonb) || excluded.value`,
        updatedAt: sql`now()`,
      },
    });
}

/** Cambia campos del pedido de una nota que sigue pendiente (cancelarlo o entregarlo). Devuelve si lo encontró pendiente. */
export async function cerrarPedido(articleId: string, cambios: Partial<PedidoImagen>): Promise<boolean> {
  const parche = JSON.stringify(cambios);
  const filas = await db
    .update(siteSettings)
    .set({
      value: sql`(select coalesce(jsonb_agg(case when e->>'articleId' = ${articleId} and e->>'estado' = 'pendiente' then e || ${parche}::jsonb else e end), '[]'::jsonb) from jsonb_array_elements(${siteSettings.value}) e)`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(siteSettings.key, IMAGENES_KEY), sql`exists (select 1 from jsonb_array_elements(${siteSettings.value}) e where e->>'articleId' = ${articleId} and e->>'estado' = 'pendiente')`))
    .returning({ key: siteSettings.key });
  return filas.length > 0;
}

/** Diseñadores activos a los que se les puede pedir una imagen, por nombre. */
export async function disenadoresActivos(): Promise<{ id: string; nombre: string }[]> {
  const filas = await db.select({ id: users.id, nombre: users.name }).from(users).where(and(eq(users.active, true), inArray(users.role, ["disenador"])));
  return filas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** ¿Es un diseñador activo? */
export async function esDisenadorActivo(id: string): Promise<boolean> {
  const [d] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, id), eq(users.active, true), eq(users.role, "disenador"))).limit(1);
  return !!d;
}
