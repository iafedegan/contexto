"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { afinarUbicacion } from "@/app/acciones/ubicacion";
import { captureGeo, LOC_COOKIE, readCookie, readGeo, type GeoPoint } from "@/lib/geo-consent";

/**
 * Segunda oportunidad de ubicar al suscriptor, en la página de «suscripción
 * confirmada»: si en este dispositivo ya había autorizado la ubicación se
 * envía sola; si no, un botón de un clic (el navegador pide permiso).
 */
export function RefineLocation({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const auto = useRef(false);

  async function send(p: Pick<GeoPoint, "lat" | "lon" | "acc">) {
    setState("working");
    const res = await afinarUbicacion({ token, lat: p.lat, lon: p.lon, accuracy: p.acc });
    setState(res.ok ? "done" : "error");
  }

  async function pedir() {
    setState("working");
    if (!(await captureGeo())) return setState("error");
    const g = JSON.parse(readGeo() ?? "null") as GeoPoint | null;
    if (g) await send(g);
    else setState("error");
  }

  useEffect(() => {
    if (auto.current) return;
    auto.current = true;
    if (readCookie(LOC_COOKIE) !== "granted") return;
    try {
      const g = JSON.parse(readGeo() ?? "null") as GeoPoint | null;
      if (g && Date.now() - g.t < 24 * 3600 * 1000) queueMicrotask(() => void send(g));
    } catch {
      /* sin ubicación guardada: queda el botón */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "done") {
    return <p className="mt-8 text-sm font-medium text-[var(--accent)]">Gracias: ya sabemos de qué zona nos lees.</p>;
  }
  return (
    <div className="mt-8 rounded-[var(--radius)] border border-[var(--border)] p-4 text-sm">
      <p className="text-[var(--fg-muted)]">
        ¿Nos ayudas a saber de qué zona nos lees? Solo lo usamos para conocer a nuestra audiencia; tu navegador te pedirá permiso.
      </p>
      <button type="button" onClick={pedir} disabled={state === "working"} className="lx-btn mt-3 inline-flex items-center gap-2 disabled:opacity-60">
        <LocateFixed size={15} /> {state === "working" ? "Buscando tu ubicación…" : "Compartir mi ubicación"}
      </button>
      {state === "error" && (
        <p className="mt-2 text-xs text-[var(--fg-muted)]">No pudimos obtenerla (revisa el permiso del navegador). No pasa nada: puedes seguir sin ella.</p>
      )}
    </div>
  );
}
