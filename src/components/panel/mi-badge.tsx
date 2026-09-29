"use client";

import { useSession } from "next-auth/react";

/** Nombre y rol en la barra del panel — vive del lado del cliente para que
 * refleje al instante un cambio hecho en "Mis datos" (ver mi-perfil-form). */
export function MiBadge({ name, role }: { name: string; role: string }) {
  const { data } = useSession();
  return (
    <span className="lx-chip border-[var(--border)] text-[var(--fg-muted)]">
      {data?.user?.name ?? name} · {data?.user?.role ?? role}
    </span>
  );
}
