"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { requireRole } from "@/lib/auth";

/** Alterna la marca de atendido de un mensaje del formulario público. */
export async function marcarAtendido(formData: FormData) {
  await requireRole("editor");
  const id = String(formData.get("id") ?? "");
  const handled = String(formData.get("handled") ?? "1") === "1";
  if (!id) return;
  await db.update(contactMessages).set({ handled }).where(eq(contactMessages.id, id));
  revalidatePath("/panel/mensajes");
}
