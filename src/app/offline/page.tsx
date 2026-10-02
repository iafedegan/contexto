import Link from "next/link";
import type { Metadata } from "next";
import { SavedList } from "./saved-list";

export const metadata: Metadata = {
  title: "Sin conexión",
  robots: { index: false, follow: false },
};

/**
 * Fallback de navegación que el Service Worker sirve cuando no hay red y la
 * página pedida no está en caché (offline shell de la PWA).
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-2xl">
        📡
      </div>
      <h1 className="text-xl font-bold text-[var(--fg)]">Sin conexión</h1>
      <p className="text-sm text-[var(--fg-muted)]">
        No pudimos cargar esta página porque tu dispositivo está sin conexión a internet.
        Las últimas noticias y las que ya visitaste siguen disponibles sin conexión.
      </p>
      <SavedList />
      <Link
        href="/"
        className="mt-2 rounded-[var(--radius)] bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-fg)]"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
