"use client";

import { useRouter } from "next/navigation";
import { SectionTree, type PaginaDeSeccion, type SectionNode } from "@/components/panel/section-tree";

/**
 * El árbol de secciones dentro de Páginas: al elegir una sección aparecen sus páginas («Editar página») y «Página nueva en …»
 * para crear otra colgando de ella.
 */
export function ArbolPaginas({ sections, paginas }: { sections: SectionNode[]; paginas: PaginaDeSeccion[] }) {
  const router = useRouter();
  return <SectionTree sections={sections} paginas={paginas} onSaved={() => router.refresh()} />;
}
