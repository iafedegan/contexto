"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { marcarPendientesVistos } from "@/app/panel/(app)/pendientes/actions";

/** Al abrir «Mis pendientes» da por vistas las tareas nuevas y refresca el menú (la insignia y el aviso). */
export function MarcarVistos({ hayNuevas }: { hayNuevas: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!hayNuevas) return;
    marcarPendientesVistos().then(() => router.refresh()).catch(() => {});
  }, [hayNuevas, router]);
  return null;
}
