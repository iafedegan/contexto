import "server-only";
import { contarImagenesPendientes } from "@/lib/imagenes-pedidas";
import { contarNotasPendientes } from "@/lib/notas-asignadas";
import { totalSinLeer } from "@/lib/comentarios-notas";
import { contarMisPendientes } from "./pendientes/consultas";
import type { Avisos } from "@/components/panel/avisos-menu";

/** Los números rojos del menú de una persona: piezas del grupo de redacción (y cuántas no ha abierto), notas que le enviaron, pedidos de imagen y comentarios sin leer. */
export async function contarAvisos(user: { id: string; role: string }): Promise<Avisos> {
  const [tareas, notas, imagenes, comentarios] = await Promise.all([
    contarMisPendientes(user.id),
    contarNotasPendientes(user.id),
    contarImagenesPendientes(user.id, user.role),
    totalSinLeer({ id: user.id, role: user.role }),
  ]);
  return { pendientes: tareas.total, nuevas: tareas.nuevas, notas, imagenes, comentarios };
}
