/**
 * Comprobación de las citas de una respuesta del asistente (H-08). El texto del modelo solo se muestra si cita al menos
 * un fragmento con un marcador `[n]` y TODOS los marcadores apuntan a un fragmento que existe; si no, se descarta y se
 * muestran las fuentes sin generación. Función pura, sin servidor, para poder probarla.
 */
export function analizarCitas(texto: string, totalFuentes: number): { usadas: number[]; invalidas: boolean; valida: boolean } {
  const marcadores = [...texto.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  const usadas = [...new Set(marcadores.filter((n) => n >= 1 && n <= totalFuentes))].sort((a, b) => a - b);
  const invalidas = marcadores.some((n) => n < 1 || n > totalFuentes);
  return { usadas, invalidas, valida: usadas.length > 0 && !invalidas };
}
