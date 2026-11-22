import { useEffect, useSyncExternalStore } from "react";

/**
 * Datos pequeños que las páginas ESTÁTICAS piden desde el navegador (`/api/ultima-hora`, `/api/anuncios`, `/api/cintillo`) en vez de
 * pintarlos en el servidor: así una nota guardada en la caché no se tiene que regenerar cuando cambia la última hora, un anuncio o una
 * cotización. Una sola petición por dirección aunque la pidan varios componentes; se repite al navegar a otra página si pasaron más de
 * 30 s. La última respuesta se guarda en `sessionStorage` para pintarla de entrada en la siguiente página (sin esperar a la red).
 *
 * Si la respuesta falla, tarda más de `ESPERA_MS`, no es JSON (p. ej. un desafío del firewall) o no tiene la forma esperada, queda
 * `fallo: true` y quien la usa no pinta nada: la nota se ve bien igual, sin la pieza y sin errores. Solo para componentes de cliente.
 */

/** Lo que ve un componente: el dato (o null mientras llega) y si ya se sabe que no va a llegar. */
export type EstadoRecurso<T> = { valor: T | null; fallo: boolean };

type Entrada<T> = { estado: EstadoRecurso<T>; pedido: boolean; pedidoEn: number; oyentes: Set<() => void> };

const entradas = new Map<string, Entrada<unknown>>();
const VIGENCIA_MS = 30_000;
/** Lo más que se espera una respuesta: después, la pieza no se muestra (y no queda un hueco esperando para siempre). */
const ESPERA_MS = 5_000;
// En el servidor y al hidratar: cargando (constante, para que React no vea un dato nuevo en cada lectura).
const CARGANDO: EstadoRecurso<never> = { valor: null, fallo: false };

// Entrada de una dirección; la primera vez arranca con lo que quedó guardado en la sesión (si lo hay y tiene la forma esperada).
function entradaDe<T>(url: string, valido: (v: unknown) => v is T): Entrada<T> {
  let e = entradas.get(url) as Entrada<T> | undefined;
  if (!e) {
    let guardado: T | null = null;
    try {
      const texto = sessionStorage.getItem(`cg-recurso:${url}`);
      const v: unknown = texto ? JSON.parse(texto) : null;
      if (v !== null && valido(v)) guardado = v;
    } catch {
      // Sin almacenamiento (modo privado, bloqueado) o dato dañado: se espera a la red.
    }
    e = { estado: guardado === null ? CARGANDO : { valor: guardado, fallo: false }, pedido: false, pedidoEn: 0, oyentes: new Set() };
    entradas.set(url, e as Entrada<unknown>);
  }
  return e;
}

// Pide la dirección si no hay un pedido reciente; al terminar (bien o mal) avisa a quien la usa.
function pedir<T>(url: string, valido: (v: unknown) => v is T) {
  const e = entradaDe(url, valido);
  if (e.pedido || Date.now() - e.pedidoEn < VIGENCIA_MS) return;
  e.pedido = true;
  e.pedidoEn = Date.now();
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_MS);
  fetch(url, { credentials: "omit", signal: corte.signal })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((v: unknown) => {
      if (!valido(v)) throw new Error("respuesta con otra forma");
      e.estado = { valor: v, fallo: false };
      try {
        sessionStorage.setItem(`cg-recurso:${url}`, JSON.stringify(v));
      } catch {
        // Sin almacenamiento: no pasa nada, la siguiente página vuelve a pedirlo.
      }
    })
    .catch(() => {
      // Falló, tardó demasiado o llegó otra cosa: si había un dato de antes se sigue usando; si no, la pieza no se pinta.
      e.pedidoEn = 0;
      if (e.estado.valor === null) e.estado = { valor: null, fallo: true };
    })
    .finally(() => {
      clearTimeout(reloj);
      e.pedido = false;
      e.oyentes.forEach((f) => f());
    });
}

/**
 * El valor de `url` (JSON que pasa `valido`) y si falló. En el servidor y al hidratar siempre está cargando: lo que dependa de esto se
 * pinta solo en el navegador, y la página guardada en la caché no cambia. Con `url` nulo no pide nada (el dato ya vino del servidor).
 * `valido` debe ser una función fija (definida fuera del componente).
 */
export function useRecurso<T>(url: string | null, valido: (v: unknown) => v is T, clave?: string | null): EstadoRecurso<T> {
  const estado = useSyncExternalStore(
    (avisar) => {
      if (!url) return () => {};
      const e = entradaDe(url, valido);
      e.oyentes.add(avisar);
      return () => e.oyentes.delete(avisar);
    },
    () => (url ? entradaDe(url, valido).estado : CARGANDO),
    () => CARGANDO,
  );
  // `clave` (p. ej. la dirección de la página) vuelve a pedir el dato al navegar, si ya pasó la vigencia.
  useEffect(() => {
    if (url) pedir(url, valido);
  }, [url, clave, valido]);
  return estado;
}

/** ¿Es un objeto (no nulo ni lista)? Ayuda para los validadores de cada respuesta. */
export const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** ¿Es texto o null? */
export const textoONulo = (v: unknown): v is string | null => v === null || typeof v === "string";
