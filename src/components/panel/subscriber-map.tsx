"use client";

import { useEffect, useRef } from "react";

export type SubscriberPoint = {
  lat: number;
  lon: number;
  name: string | null;
  email: string;
  city: string | null;
  country: string | null;
  postal: string | null;
  neighborhood: string | null;
  /** true = ubicación exacta compartida por la persona; false = aproximada por IP. */
  exact: boolean;
  date: string | null;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

// Leaflet no está instalado como dependencia (se carga por CDN, ver arriba),
// así que no hay tipos suyos disponibles: se tipa aquí lo mínimo que se usa.
type LeafletLib = {
  map(el: HTMLElement): {
    setView(c: [number, number], z: number): unknown;
    fitBounds(b: [number, number][], o?: Record<string, unknown>): unknown;
    remove(): void;
  };
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
      const map = L.map(elRef.current);
      map.setView([4.5, -74.1], 5);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);

      for (const p of points) {
        L.circleMarker([p.lat, p.lon], {
          radius: p.exact ? 6 : 9,
          color: p.exact ? "#15803d" : "#b4622e",
          fillColor: p.exact ? "#15803d" : "#b4622e",
          fillOpacity: p.exact ? 0.85 : 0.35,
          weight: 1.5,
        })
          .bindPopup(
            [
              p.name ? `<strong>${esc(p.name)}</strong>` : "",
              esc(p.email),
              `${esc(p.city ?? "Ciudad desconocida")}${p.country ? ", " + esc(p.country) : ""}`,
              p.neighborhood ? `Barrio ${esc(p.neighborhood)}` : "",
              p.postal ? `C.P. ${esc(p.postal)}` : "",
              p.exact ? "Ubicación exacta" : "Ubicación aproximada (IP)",
              p.date ? `Alta: ${esc(p.date)}` : "",
            ]
              .filter(Boolean)
              .join("<br>"),
          )
          .addTo(map);
      }
      if (points.length > 0) {
        map.fitBounds(
          points.map((p) => [p.lat, p.lon] as [number, number]),
          { padding: [40, 40], maxZoom: 13 },
        );
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
