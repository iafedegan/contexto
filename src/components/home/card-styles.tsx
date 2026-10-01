"use client";

import { createContext, useContext } from "react";

/** Slug de cada tarjeta de la portada, por posición (`data-card-index`). */
const SlugsContext = createContext<string[]>([]);

export function CardSlugsProvider({ slugs, children }: { slugs: string[]; children: React.ReactNode }) {
  return <SlugsContext.Provider value={slugs}>{children}</SlugsContext.Provider>;
}

export const useCardSlug = (index: number): string | undefined => useContext(SlugsContext)[index];
