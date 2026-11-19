"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { avisosDelMenu } from "@/app/panel/(app)/avisos-actions";

/** Los números rojos del menú del panel. */
export type Avisos = { pendientes: number; nuevas: number; notas: number; imagenes: number; comentarios: number };

const SIN_AVISOS: Avisos = { pendientes: 0, nuevas: 0, notas: 0, imagenes: 0, comentarios: 0 };
const Ctx = createContext<Avisos>(SIN_AVISOS);

/** Los números del menú, al día. */
export const useAvisos = () => useContext(Ctx);

const claveDe = (a: Avisos) => `${a.pendientes}|${a.nuevas}|${a.notas}|${a.imagenes}|${a.comentarios}`;

/**
 * Mantiene al día los números del menú. El layout del panel los calcula al cargar la página, pero al pasar de una pantalla a otra Next no lo
 * vuelve a dibujar: un pedido de imagen que otra persona quitó seguía marcando «1» en «Solicitud de imágenes» horas después, con la lista
 * vacía. Ahora se vuelven a pedir al cambiar de pantalla y al volver a la pestaña. No se piden con un reloj: una pestaña olvidada no debe
 * mantener viva la sesión, que se cierra tras 4 horas sin uso.
 */
export function AvisosMenu({ inicial, children }: { inicial: Avisos; children: React.ReactNode }) {
  const pathname = usePathname();
  const clave = claveDe(inicial);
  // Lo que respondió el servidor y con qué números del layout se pidió: si el layout se vuelve a dibujar (otros números), mandan los suyos.
  const [remoto, setRemoto] = useState<{ de: string; v: Avisos } | null>(null);
  const claveRef = useRef(clave);
  const turno = useRef(0);
  const montado = useRef(false);

  useEffect(() => {
    claveRef.current = clave;
  }, [clave]);

  useEffect(() => {
    const pedir = () => {
      const n = ++turno.current;
      avisosDelMenu()
        .then((v) => {
          // Solo la última respuesta cuenta (dos cambios de pantalla seguidos no se pisan).
          if (v && n === turno.current) setRemoto({ de: claveRef.current, v });
        })
        .catch(() => {});
    };
    // Al cargar, los números del layout ya están al día.
    if (montado.current) pedir();
    montado.current = true;
    const alVolver = () => {
      if (document.visibilityState === "visible") pedir();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [pathname]);

  const valor = remoto && remoto.de === clave ? remoto.v : inicial;
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
