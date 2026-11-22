import { useEffect, useSyncExternalStore } from "react";

/**
 * Datos pequeños que las páginas ESTÁTICAS piden desde el navegador (`/api/ultima-hora`, `/api/anuncios`, `/api/cintillo`) en vez de
 * pintarlos en el servidor: así una nota guardada en la caché no se tiene que regenerar cuando cambia la última hora, un anuncio o una
 * cotización. Una sola petición por dirección aunque la pidan varios componentes; se repite al navegar a otra página si pasaron más de
 * 30 s. La última respuesta se guarda en `sessionStorage` para pintarla de entrada en la siguiente página (sin esperar a la red).
 * Solo para componentes de cliente.
 */

type Entrada<T> = { valor: T | null; pedido: Promise<void> | null; pedidoEn: number; oyentes: Set<() => void> };

const entradas = new Map<string, Entrada<unknown>>();
const VIGENCIA_MS = 30_000;

// Entrada de una dirección; la primera vez arranca con lo que quedó guardado en la sesión (si lo hay).
function entradaDe<T>(url: string): Entrada<T> {
  let e = entradas.get(url) as Entrada<T> | undefined;
  if (!e) {
    let guardado: T | null = null;
    try {
      const texto = sessionStorage.getItem(`cg-recurso:${url}`);
      if (texto) guardado = JSON.parse(texto) as T;
    } catch {
      // Sin almacenamiento (modo privado, bloqueado): se espera a la red.
    }
    e = { valor: guardado, pedido: null, pedidoEn: 0, oyentes: new Set() };
    entradas.set(url, e as Entrada<unknown>);
  }
  return e;
}

// Pide la dirección si no hay un pedido reciente; al llegar, avisa a quien la usa y la guarda para la siguiente página.
function pedir<T>(url: string) {
  const e = entradaDe<T>(url);
  if (e.pedido || Date.now() - e.pedidoEn < VIGENCIA_MS) return;
  e.pedidoEn = Date.now();
  e.pedido = fetch(url, { credentials: "omit" })
    .then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(String(r.status)))))
    .then((valor) => {
      e.valor = valor;
      try {
        sessionStorage.setItem(`cg-recurso:${url}`, JSON.stringify(valor));
      } catch {
        // Sin almacenamiento: no pasa nada, la siguiente página vuelve a pedirlo.
      }
      e.oyentes.forEach((f) => f());
    })
    .catch(() => {
      // Un fallo no rompe la página: se queda con lo que tenía (o sin nada) y se reintenta en la siguiente página.
      e.pedidoEn = 0;
    })
    .finally(() => {
      e.pedido = null;
    });
}

/**
 * El valor de `url` (JSON), o `null` mientras no haya llegado. En el servidor y al hidratar siempre es `null`: lo que dependa de esto
 * se pinta solo en el navegador, y la página guardada en la caché no cambia. Con `url` nulo no pide nada (el dato ya vino del servidor).
 */
export function useRecurso<T>(url: string | null, clave?: string | null): T | null {
  const valor = useSyncExternalStore(
    (avisar) => {
      if (!url) return () => {};
      const e = entradaDe<T>(url);
      e.oyentes.add(avisar);
      return () => e.oyentes.delete(avisar);
    },
    () => (url ? entradaDe<T>(url).valor : null),
    () => null,
  );
  // `clave` (p. ej. la dirección de la página) vuelve a pedir el dato al navegar, si ya pasó la vigencia.
  useEffect(() => {
    if (url) pedir<T>(url);
  }, [url, clave]);
  return valor;
}
