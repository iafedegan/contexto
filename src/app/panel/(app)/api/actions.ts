"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiClients } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { generateApiKey } from "@/lib/api/keys";

// Refresca la pantalla de claves de API.
const REVALIDATE = () => revalidatePath("/panel/api");

/** Crea un cliente y devuelve la clave EN CLARO una sola vez: no se guarda así. */
export async function createApiClient(name: string): Promise<{ ok: boolean; key?: string; message: string }> {
  const user = await requirePermiso("api");
  const clean = name.trim().slice(0, 80);
  if (clean.length < 2) return { ok: false, message: "Ponle un nombre a la clave (para qué o quién la usa)." };

  const { key, hash, prefix } = generateApiKey();
  await db.insert(apiClients).values({ name: clean, keyHash: hash, keyPrefix: prefix, createdBy: user.id });
  REVALIDATE();
  return { ok: true, key, message: "Clave creada. Cópiala ahora: no se volverá a mostrar." };
}

// Activa o revoca una clave de API (requiere el permiso «api»).
export async function toggleApiClient(id: string, active: boolean): Promise<void> {
  await requirePermiso("api");
  await db.update(apiClients).set({ active }).where(eq(apiClients.id, id));
  REVALIDATE();
}

// Borra una clave de API (requiere el permiso «api»).
export async function deleteApiClient(id: string): Promise<void> {
  await requirePermiso("api");
  await db.delete(apiClients).where(eq(apiClients.id, id));
  REVALIDATE();
}
