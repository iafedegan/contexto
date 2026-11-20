"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { crearFirma } from "@/lib/user-authors";
import { invalidarCache, TAG_CONTENIDO } from "@/lib/data-cache";

type Resultado = { ok: true; message?: string } | { ok: false; message: string };

const refrescar = () => {
  revalidatePath("/panel/comentaristas");
  revalidatePath("/panel/articulos", "layout");
};

/** Solo un administrador maneja las firmas. */
const admin = () => requireRole("administrador");

/** Crea una firma (comentarista o autor sin cuenta); si ya existe una con ese nombre no la duplica. */
export async function crearComentarista(nombre: string): Promise<Resultado> {
  await admin();
  const r = await crearFirma(String(nombre ?? ""));
  if (!r.ok) return { ok: false, message: r.message };
  refrescar();
  return { ok: true, message: r.creada ? `Se creó «${r.name}».` : `Ya existía «${r.name}».` };
}

/** Cambia el nombre y la biografía. La dirección (slug) no cambia, para no romper los enlaces ya publicados. */
export async function editarComentarista(id: string, nombre: string, bio: string): Promise<Resultado> {
  await admin();
  const name = String(nombre ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 80) return { ok: false, message: "Escribe el nombre (de 2 a 80 letras)." };
  const texto = String(bio ?? "").trim().slice(0, 600);
  const filas = await db.update(authors).set({ name, bio: texto || null }).where(eq(authors.id, String(id))).returning({ id: authors.id });
  if (!filas.length) return { ok: false, message: "Esa firma ya no existe." };
  refrescar();
  return { ok: true, message: "Guardado." };
}

/** Activa o inactiva una firma: inactiva, ya no sale al elegir autor de una nota (las notas que la llevan siguen firmadas con ella). */
export async function activarComentarista(id: string, activo: boolean): Promise<Resultado> {
  await admin();
  const filas = await db.update(authors).set({ active: !!activo }).where(eq(authors.id, String(id))).returning({ id: authors.id });
  if (!filas.length) return { ok: false, message: "Esa firma ya no existe." };
  refrescar();
  // El directorio público de columnistas solo lista las firmas activas: se actualiza al instante, sin esperar a la caché de 10 minutos.
  invalidarCache(TAG_CONTENIDO);
  revalidatePath("/categoria/columnistas");
  return { ok: true };
}

/** Borra una firma. Si ya firma notas no se borra (dejaría las notas sin autor): se inactiva. Una firma de una cuenta del panel tampoco se borra. */
export async function borrarComentarista(id: string): Promise<Resultado> {
  await admin();
  const [a] = await db.select({ id: authors.id, userId: authors.userId, name: authors.name }).from(authors).where(eq(authors.id, String(id))).limit(1);
  if (!a) return { ok: false, message: "Esa firma ya no existe." };
  if (a.userId) return { ok: false, message: "Es la firma de una cuenta del panel: no se borra. Si ya no escribe, inactívala (o desactiva su cuenta en Configuración › Personas)." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(articles).where(eq(articles.authorId, a.id));
  if (n > 0) return { ok: false, message: `«${a.name}» firma ${n} nota${n === 1 ? "" : "s"}: no se puede borrar sin dejarlas sin autor. Inactívala para que no se ofrezca más.` };
  await db.delete(authors).where(eq(authors.id, a.id));
  refrescar();
  return { ok: true, message: "Borrada." };
}
