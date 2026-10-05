"use client";

import { createContext, useContext } from "react";

/** Slug de cada tarjeta de la portada, por posición (`data-card-index`). */
const SlugsContext = createContext<string[]>([]);

// Provee el orden de las notas a las tarjetas para que el editor identifique cada una.
export function CardSlugsProvider({ slugs, children }: { slugs: string[]; children: React.ReactNode }) {
  return <SlugsContext.Provider value={slugs}>{children}</SlugsContext.Provider>;
}

// Dirección de la nota que ocupa una posición de la portada.
export const useCardSlug = (index: number): string | undefined => useContext(SlugsContext)[index];
