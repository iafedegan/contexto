"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, siteSettings, users } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { guardarBorradorCore } from "@/lib/article-ops";
import { autorDeUsuario } from "@/lib/user-authors";
import { ASIGNADAS_KEY, type Asignacion } from "./consultas";

/**
 * Preescribe una nota y se la deja a un editor: crea el BORRADOR a nombre de ese editor (así le aparece en «Artículos», donde la termina, la
 * revisa y la publica él) con la firma de quien la preescribió, y anota la asignación para las listas de «Notas para editores». Nunca publica.
 */
export async function asignarNota(input: { titulo: string; resumen: string; texto: string; categoryId: string; editorId: string; mensaje: string }): Promise<{ ok: boolean; message: string; id?: string }> {
  const yo = await requirePermiso("asignar_notas");
  const titulo = String(input.titulo ?? "").trim();
  if (titulo.length < 5) return { ok: false, message: "Escribe un título de al menos 5 letras." };
  const texto = String(input.texto ?? "").trim();
  if (texto.length < 20) return { ok: false, message: "Escribe la nota (o al menos el esquema) para que el editor tenga con qué trabajar." };

  const [editor] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, String(input.editorId)), eq(users.active, true), inArray(users.role, ["editor", "administrador"]))).limit(1);
  if (!editor) return { ok: false, message: "Elige un editor de la lista." };
  const categoryId = input.categoryId ? (await db.select({ id: categories.id }).from(categories).where(eq(categories.id, input.categoryId)).limit(1))[0]?.id ?? null : null;

  // Texto plano → párrafos; el editor lo trabaja en el editor de siempre.
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const body = texto.split(/\n{2,}/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");

  const r = await guardarBorradorCore(editor.id, { title: titulo, excerpt: String(input.resumen ?? "").trim().slice(0, 400), body, tags: [], categoryId, authorId: await autorDeUsuario(yo.id) });
  if (!r.ok) return { ok: false, message: "No se pudo guardar la nota. Inténtalo de nuevo." };

  const entrada: Asignacion = { articleId: r.id, editorId: editor.id, porId: yo.id, mensaje: String(input.mensaje ?? "").trim().slice(0, 600), fecha: new Date().toISOString() };
  // Una sola sentencia: dos asignaciones a la vez no se pisan.
  await db
    .insert(siteSettings)
    .values({ key: ASIGNADAS_KEY, value: [entrada] })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: sql`${siteSettings.value} || excluded.value`, updatedAt: sql`now()` } });
  revalidatePath("/panel/asignaciones");
  revalidatePath("/panel/articulos");
  return { ok: true, message: "Nota asignada. El editor la verá en «Artículos» y en su lista de «Notas para editores».", id: r.id };
}
