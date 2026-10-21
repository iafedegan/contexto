"use server";

import { requireRole } from "@/lib/auth";
import { resumenUsoIA } from "@/lib/ai-uso";

/** Consumo de IA del mes: por modelo (de todo el equipo) y lo de la propia persona; el presupuesto del asistente solo lo recibe un administrador. */
export async function usoIAResumen() {
  const user = await requireRole("redactor");
  return resumenUsoIA(user.id, user.role === "administrador");
}
