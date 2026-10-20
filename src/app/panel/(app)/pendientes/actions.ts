"use server";

import { auth } from "@/lib/auth";
import { marcarVistas } from "./consultas";

/** Da por vistas las tareas nuevas de quien tiene la sesión (abrió «Mis pendientes» o cerró el aviso). */
export async function marcarPendientesVistos(): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  await marcarVistas(session.user.id);
}
