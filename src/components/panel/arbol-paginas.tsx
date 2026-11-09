"use client";

import { useRouter } from "next/navigation";
import { SectionTree, type SectionNode } from "@/components/panel/section-tree";

/** El árbol de secciones dentro de Páginas: al elegir una sección aparece «Página nueva en …» para crearla colgando de ella. */
export function ArbolPaginas({ sections }: { sections: SectionNode[] }) {
  const router = useRouter();
  return <SectionTree sections={sections} onSaved={() => router.refresh()} />;
}
