/**
 * Limitador de concurrencia: devuelve una función que ejecuta las tareas que se le pasen con, a lo sumo, `max`
 * en marcha a la vez; el resto espera su turno en orden de llegada. Sirve para no lanzar de golpe quince descargas
 * al mismo servidor externo (que puede atascarse o limitar las ráfagas).
 *
 * El cupo se entrega directamente al siguiente en la cola al terminar una tarea, así que nunca hay más de `max`
 * tareas simultáneas, ni siquiera durante el relevo.
 */
export function limitador(max: number): <R>(tarea: () => Promise<R>) => Promise<R> {
  const tope = Math.max(1, Math.floor(max));
  let activas = 0;
  const cola: Array<() => void> = [];
  return async function ejecutar<R>(tarea: () => Promise<R>): Promise<R> {
    if (activas >= tope) await new Promise<void>((entra) => cola.push(entra));
    else activas++;
    try {
      return await tarea();
    } finally {
      const siguiente = cola.shift();
      if (siguiente) siguiente();
      else activas--;
    }
  };
}
