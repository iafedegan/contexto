import type { Metadata } from "next";
import { HomeRealEmbed } from "@/components/panel/home-real-preview";

/**
 * La portada REAL con el borrador del editor aplicado, sin marco ni cabecera
 * del panel: la incrusta en un iframe el lienzo de /panel/portada. Solo para
 * editores (la comprobación va dentro), nunca indexable.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vista previa de portada", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ popup?: string }> }) {
  const { popup } = await searchParams;
  return <HomeRealEmbed popup={popup === "1" ? "show" : "hide"} />;
}
