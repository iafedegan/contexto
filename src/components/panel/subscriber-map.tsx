"use client";

import { useEffect, useRef } from "react";

export type SubscriberPoint = {
  lat: number;
  lon: number;
  city: string | null;
  country: string | null;
  n: number;
  /** Códigos postales (por geo-IP) de los suscriptores de esa ciudad, con su cuenta. */
  postales: Record<string, number>;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

// Leaflet no está instalado como dependencia (se carga por CDN, ver arriba),
// así que no hay tipos suyos disponibles: se tipa aquí lo mínimo que se usa.
type LeafletLib = {
  map(el: HTMLElement): { setView(c: [number, number], z: number): unknown; remove(): void };
  tileLayer(url: string, opts: Record<string, unknown>): { addTo(map: unknown): unknown };
  circleMarker(
    c: [number, number],
    opts: Record<string, unknown>,
  ): { bindPopup(html: string): { addTo(map: unknown): unknown } };
};

/**
 * Mapa real (Colombia/mundo) de dónde se dan de alta los suscriptores.
 * Leaflet se carga desde CDN en vez de instalarlo como dependencia: así no
 * hace falta tocar package.json ni el build de Next por un mapa que solo
 * vive en una pestaña del panel. Los puntos vienen de x-vercel-ip-latitude/
 * -longitude en el alta (ver acciones/boletin.ts) — sin geocodificar nada.
 */
export function SubscriberMap({ points }: { points: SubscriberPoint[] }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = LEAFLET_CSS;
        document.head.appendChild(link);
      }
      const win = window as unknown as { L?: LeafletLib };
      const L: LeafletLib =
        win.L ??
        (await new Promise<LeafletLib>((resolve, reject) => {
          const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`);
          if (existing) {
            existing.addEventListener("load", () => resolve(win.L!));
            return;
          }
          const script = document.createElement("script");
          script.src = LEAFLET_JS;
          script.onload = () => resolve(win.L!);
          script.onerror = reject;
          document.head.appendChild(script);
        }));

      if (cancelled || !elRef.current) return;

      // Colombia por defecto (es donde vive casi toda la audiencia); si hay
      // puntos fuera se ve igual, el usuario puede alejar el zoom.
      const map = L.map(elRef.current).setView([4.5, -74.1], 5);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);

      const max = Math.max(1, ...points.map((p) => p.n));
      for (const p of points) {
        const radio = 6 + (p.n / max) * 18;
        L.circleMarker([p.lat, p.lon], {
          radius: radio,
          color: "#b4622e",
          fillColor: "#b4622e",
          fillOpacity: 0.45,
          weight: 1.5,
        })
          .bindPopup(
            `${esc(p.city ?? "Ciudad desconocida")}${p.country ? ", " + esc(p.country) : ""} · ${p.n} suscriptor${p.n === 1 ? "" : "es"}` +
              (Object.keys(p.postales).length
                ? "<br>" +
                  Object.entries(p.postales)
                    .sort((a, b) => b[1] - a[1])
                    .map(([b, n]) => `C.P. ${esc(b)} (${n})`)
                    .join("<br>")
                : ""),
          )
          .addTo(map);
      }
    }

    boot();
    return () => {
      cancelled = true;
      const map = mapRef.current as { remove?: () => void } | null;
      map?.remove?.();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (points.length === 0) {
    return (
      <p className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[var(--fg-muted)]">
        Todavía no hay altas con ubicación registrada. Se va llenando con cada suscripción nueva.
      </p>
    );
  }

  return (
    <div
      ref={elRef}
      className="h-[420px] w-full overflow-hidden rounded-[var(--radius)] border border-[var(--border)]"
    />
  );
}
