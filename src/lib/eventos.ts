/**
 * Bus de eventos de dominio (en proceso).
 *
 * Los módulos NO se llaman entre sí para reaccionar a lo que pasa en otro: quien origina un hecho lo anuncia con
 * `emitir`, y quien quiera reaccionar se suscribe con `alOcurrir` (ver src/lib/oyentes.ts, donde se cablea todo).
 * Así «contenido» publica una nota sin saber que existe «canales» (push), y mañana se puede añadir otra reacción
 * (newsletter, sitemap…) sin tocar el módulo que publica.
 *
 * Los oyentes corren en el mismo proceso y en el mismo contexto de la petición (pueden usar `after()`); un oyente
 * que falla se registra y nunca rompe a quien emitió el evento. El registro vive en `globalThis` porque Next
 * puede cargar este archivo en más de un paquete (instrumentación, rutas, acciones) y todos deben compartirlo.
 */

/** Eventos que existen y lo que cada uno lleva. Añadir uno aquí es lo único necesario para estrenarlo. */
export type EventosDelSistema = {
  /** Una o varias notas pasaron a «publicado» (a mano, por Telegram o por programación). */
  "nota.publicada": { ids: string[] };
};

type Oyente<K extends keyof EventosDelSistema> = (carga: EventosDelSistema[K]) => void | Promise<void>;

const clave = "__cgOyentes";
const registro = ((globalThis as Record<string, unknown>)[clave] ??= new Map()) as Map<string, Oyente<never>[]>;

/** Suscribe un oyente a un evento. Devuelve la función que lo da de baja. */
export function alOcurrir<K extends keyof EventosDelSistema>(evento: K, oyente: Oyente<K>): () => void {
  const lista = registro.get(evento) ?? [];
  lista.push(oyente as Oyente<never>);
  registro.set(evento, lista);
  return () => registro.set(evento, (registro.get(evento) ?? []).filter((o) => o !== (oyente as Oyente<never>)));
}

/** Anuncia un hecho a todos los oyentes. No espera a que terminen ni propaga sus errores. */
export function emitir<K extends keyof EventosDelSistema>(evento: K, carga: EventosDelSistema[K]): void {
  for (const oyente of registro.get(evento) ?? []) {
    try {
      const r = (oyente as Oyente<K>)(carga);
      if (r && typeof (r as Promise<void>).catch === "function") (r as Promise<void>).catch((e) => console.error(`[eventos] ${evento}:`, e));
    } catch (e) {
      console.error(`[eventos] ${evento}:`, e);
    }
  }
}
