"use client";

import { SessionProvider } from "next-auth/react";

/** Envoltorio delgado: el panel es server-first, pero "Mis datos" necesita
 * poder empujar name/email al JWT sin recargar la página (ver mi-perfil-form). */
export function PanelSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
