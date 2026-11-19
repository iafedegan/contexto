"use server";

import { auth } from "@/lib/auth";
import type { Avisos } from "@/components/panel/avisos-menu";
import { contarAvisos } from "./avisos";

/** Los números del menú, al día, para quien tiene la sesión abierta (el menú los pide al cambiar de pantalla o al volver a la pestaña). */
export async function avisosDelMenu(): Promise<Avisos | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return contarAvisos({ id: session.user.id, role: session.user.role });
}
