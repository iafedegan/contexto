"use server";

import { requireRole } from "@/lib/auth";
import { resumenUsoIA } from "@/lib/ai-uso";

/** Consumo de IA del mes por modelo (todos los usuarios y el asistente público). Solo administradores. */
export async function usoIAResumen() {
  await requireRole("administrador");
  return resumenUsoIA();
}
