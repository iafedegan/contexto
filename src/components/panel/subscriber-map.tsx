"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, MapPin, MousePointerClick } from "lucide-react";
import { escapeHtml as esc } from "@/lib/escape";

// Punto del mapa: ubicación de un suscriptor.
export type SubscriberPoint = {
  lat: number;
  lon: number;
  name: string | null;
  email: string;
  city: string | null;
  country: string | null;
  postal: string | null;
  neighborhood: string | null;
  /** gps = GPS compartido; red = Wi-Fi/antenas compartido; ip = aproximada por IP. */
  source: "gps" | "red" | "ip";
  /** Precisión informada por el navegador, en metros. */
  accuracy: number | null;
  date: string | null;
};

type Origen = SubscriberPoint["source"];

// Hoja de estilos de Leaflet, cargada desde un CDN.
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
// Código de Leaflet, cargado desde un CDN.
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
// Mapa base de OpenStreetMap, atenuado con un filtro (ver ESTILOS) para que resalten los puntos.
const TESELAS = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

// Cómo se llama, se pinta y se explica cada origen de la ubicación.
const ORIGENES: { id: Origen; nombre: string; ayuda: string; color: string }[] = [
  { id: "gps", nombre: "GPS", ayuda: "El suscriptor compartió su ubicación exacta", color: "#0f766e" },
  { id: "red", nombre: "Wi-Fi / antenas", ayuda: "Ubicación compartida por la red, de decenas de metros", color: "#1d4ed8" },
  { id: "ip", nombre: "Por IP", ayuda: "Aproximada a la ciudad, sin permiso del suscriptor", color: "#6b7f2a" },
];

// Leaflet no está instalado como dependencia (se carga por CDN, ver arriba),
// así que no hay tipos suyos disponibles: se tipa aquí lo mínimo que se usa.
type Marcador = {
  bindPopup(html: string, o?: Record<string, unknown>): Marcador;
  bindTooltip(texto: string, o?: Record<string, unknown>): Marcador;
  on(ev: string, fn: () => void): Marcador;
  addTo(capa: unknown): Marcador;
};
type Capa = { addTo(mapa: unknown): Capa; clearLayers(): void };
type Mapa = {
  setView(c: [number, number], z: number): Mapa;
  fitBounds(b: [number, number][], o?: Record<string, unknown>): Mapa;
  getZoom(): number;
  on(ev: string, fn: () => void): Mapa;
  invalidateSize(): void;
  remove(): void;
  scrollWheelZoom: { enable(): void; disable(): void };
};
type LeafletLib = {
  map(el: HTMLElement, o?: Record<string, unknown>): Mapa;
  tileLayer(url: string, opts: Record<string, unknown>): { addTo(mapa: unknown): unknown };
  layerGroup(): Capa;
  circle(c: [number, number], opts: Record<string, unknown>): Marcador;
  circleMarker(c: [number, number], opts: Record<string, unknown>): Marcador;
  marker(c: [number, number], opts: Record<string, unknown>): Marcador;
  divIcon(opts: Record<string, unknown>): unknown;
};

// Estilos de las burbujas por ciudad y de los globos: se inyectan una vez junto a Leaflet.
const ESTILOS = `
.sm-burbuja{display:grid;place-items:center;border-radius:9999px;color:#fff;font:700 13px/1 var(--font-sans,system-ui);background:linear-gradient(135deg,#1f3f78,#2d5aa3);border:3px solid #fff;box-shadow:0 4px 14px rgba(20,40,75,.35);transition:transform .15s}
.sm-burbuja:hover{transform:scale(1.08)}
.sm-burbuja.sel{background:linear-gradient(135deg,#b45309,#d97706)}
.sm-popup .leaflet-popup-content-wrapper{border-radius:14px;box-shadow:0 10px 30px rgba(20,40,75,.25)}
.sm-popup .leaflet-popup-content{margin:12px 14px;font:13px/1.45 var(--font-sans,system-ui);color:#1c2733}
.sm-popup .sm-n{font-weight:700;font-size:14px}
.sm-popup .sm-m{color:#5b6b7b}
.sm-popup .sm-o{display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;font-weight:600}
.sm-popup .sm-o i{width:8px;height:8px;border-radius:9999px;display:inline-block}
.leaflet-container{font-family:inherit;background:#eef1f5}
.leaflet-tile-pane{filter:saturate(.45) contrast(.92) brightness(1.06)}
`;

// Ciudad de un punto, para agrupar y listar.
const ciudadDe = (p: SubscriberPoint) => p.city?.trim() || "Ciudad sin identificar";

/**
 * Mapa real de dónde se dan de alta los suscriptores, con su lectura al lado: cuántos hay, en cuántas ciudades,
 * qué tan precisa es la ubicación y el ranking de ciudades. Alejado, cada ciudad es una burbuja con su cantidad;
 * al acercar (o al pulsarla) aparece cada suscriptor. Los filtros por origen de la ubicación quitan o ponen puntos.
 *
 * Leaflet se carga desde CDN en vez de instalarlo como dependencia: así no hace falta tocar package.json por un mapa
 * que solo vive en el Resumen. Los puntos vienen de x-vercel-ip-latitude/-longitude en el alta (ver acciones/boletin.ts).
 */
export function SubscriberMap({ points }: { points: SubscriberPoint[] }) {
  const elRef = useRef<HTMLDivElement>(null);
  const libRef = useRef<LeafletLib | null>(null);
  const mapRef = useRef<Mapa | null>(null);
  const capaRef = useRef<Capa | null>(null);
  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [activos, setActivos] = useState<Record<Origen, boolean>>({ gps: true, red: true, ip: true });
  const [ciudadSel, setCiudadSel] = useState<string | null>(null);
  const [rueda, setRueda] = useState(false);

  const visibles = useMemo(() => points.filter((p) => activos[p.source]), [points, activos]);
  const porOrigen = useMemo(() => {
    const c: Record<Origen, number> = { gps: 0, red: 0, ip: 0 };
    for (const p of points) c[p.source]++;
    return c;
  }, [points]);
  // Ranking de ciudades con los puntos visibles.
  const ciudades = useMemo(() => {
    const m = new Map<string, { nombre: string; pais: string | null; puntos: SubscriberPoint[] }>();
    for (const p of visibles) {
      const k = ciudadDe(p);
      const c = m.get(k) ?? { nombre: k, pais: p.country, puntos: [] };
      c.puntos.push(p);
      m.set(k, c);
    }
    return [...m.values()].sort((a, b) => b.puntos.length - a.puntos.length);
  }, [visibles]);
  // Encuadre inicial: si el grueso está en un país, se enfoca ese (una alta suelta en el extranjero no aleja todo el mapa); «Ver todo» las incluye.
  const enfoque = useMemo(() => {
    const porPais = new Map<string, SubscriberPoint[]>();
    for (const p of visibles) porPais.set(p.country ?? "", [...(porPais.get(p.country ?? "") ?? []), p]);
    const mayor = [...porPais.values()].sort((a, b) => b.length - a.length)[0] ?? [];
    return mayor.length / Math.max(1, visibles.length) >= 0.6 ? mayor : visibles;
  }, [visibles]);
  const precisos = porOrigen.gps + porOrigen.red;
  const maxCiudad = Math.max(1, ...ciudades.map((c) => c.puntos.length));

  // Carga Leaflet y crea el mapa una sola vez.
  useEffect(() => {
    let cancelado = false;
    async function arrancar() {
      try {
        if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = LEAFLET_CSS;
          document.head.appendChild(link);
        }
        if (!document.getElementById("sm-estilos")) {
          const st = document.createElement("style");
          st.id = "sm-estilos";
          st.textContent = ESTILOS;
          document.head.appendChild(st);
        }
        const win = window as unknown as { L?: LeafletLib };
        const L: LeafletLib =
          win.L ??
          (await new Promise<LeafletLib>((resolve, reject) => {
            const existente = document.querySelector(`script[src="${LEAFLET_JS}"]`);
            if (existente) {
              existente.addEventListener("load", () => resolve(win.L!));
              existente.addEventListener("error", reject);
              return;
            }
            const script = document.createElement("script");
            script.src = LEAFLET_JS;
            script.onload = () => resolve(win.L!);
            script.onerror = reject;
            document.head.appendChild(script);
          }));
        if (cancelado || !elRef.current) return;
        // La rueda del ratón solo acerca el mapa tras un clic: así no se traba el desplazamiento de la página.
        const mapa = L.map(elRef.current, { scrollWheelZoom: false, zoomControl: true });
        mapa.setView([4.5, -74.1], 5);
        L.tileLayer(TESELAS, { attribution: "© OpenStreetMap", maxZoom: 18 }).addTo(mapa);
        capaRef.current = L.layerGroup().addTo(mapa);
        libRef.current = L;
        mapRef.current = mapa;
        setListo(true);
      } catch {
        if (!cancelado) setFallo(true);
      }
    }
    void arrancar();
    return () => {
      cancelado = true;
      mapRef.current?.remove();
      mapRef.current = null;
      capaRef.current = null;
      setListo(false);
    };
  }, []);

  // Dibuja burbujas por ciudad (mapa alejado) o un punto por suscriptor (mapa cercano).
  function pintar() {
    const L = libRef.current;
    const mapa = mapRef.current;
    const capa = capaRef.current;
    if (!L || !mapa || !capa) return;
    capa.clearLayers();
    const lista = ciudades;
    const sel = ciudadSel;
    if (mapa.getZoom() < 12) {
      for (const c of lista) {
        const n = c.puntos.length;
        const lat = c.puntos.reduce((s, p) => s + p.lat, 0) / n;
        const lon = c.puntos.reduce((s, p) => s + p.lon, 0) / n;
        const tam = Math.round(32 + Math.min(34, Math.sqrt(n) * 7));
        L.marker([lat, lon], {
          icon: L.divIcon({ className: "", html: `<span class="sm-burbuja${sel === c.nombre ? " sel" : ""}" style="width:${tam}px;height:${tam}px">${n}</span>`, iconSize: [tam, tam] }),
          keyboard: true,
          title: `${c.nombre}: ${n} suscriptor${n > 1 ? "es" : ""}`,
        })
          .on("click", () => acercar(c.puntos))
          .addTo(capa);
      }
      return;
    }
    for (const p of lista.flatMap((c) => c.puntos)) {
      const o = ORIGENES.find((x) => x.id === p.source)!;
      // Radio de precisión (lo que informa el navegador) para GPS y Wi-Fi/antenas.
      if (p.source !== "ip" && p.accuracy !== null && p.accuracy > 0) {
        L.circle([p.lat, p.lon], { radius: p.accuracy, color: o.color, weight: 1, fillColor: o.color, fillOpacity: 0.08, interactive: false }).addTo(capa);
      }
      L.circleMarker([p.lat, p.lon], {
        radius: p.source === "ip" ? 9 : 7,
        color: "#fff",
        weight: 2,
        fillColor: o.color,
        fillOpacity: p.source === "ip" ? 0.6 : 0.95,
      })
        .bindPopup(
          `<div class="sm-n">${esc(p.name ?? p.email)}</div>` +
            (p.name ? `<div class="sm-m">${esc(p.email)}</div>` : "") +
            `<div>${esc(p.city ?? "Ciudad desconocida")}${p.country ? ", " + esc(p.country) : ""}${p.neighborhood ? ` · ${esc(p.neighborhood)}` : ""}${p.postal ? ` · C.P. ${esc(p.postal)}` : ""}</div>` +
            `<div class="sm-o"><i style="background:${o.color}"></i>${esc(o.nombre)}${p.accuracy !== null && p.source !== "ip" ? ` · ±${p.accuracy} m` : ""}</div>` +
            (p.date ? `<div class="sm-m">Alta: ${esc(p.date)}</div>` : ""),
          { className: "sm-popup" },
        )
        .addTo(capa);
    }
  }
  // Los eventos de Leaflet llaman siempre a la versión más reciente de `pintar` (se actualiza tras cada render).
  const pintarRef = useRef<() => void>(() => {});
  useEffect(() => {
    pintarRef.current = pintar;
  });

  // Acerca el mapa a un grupo de puntos.
  function acercar(pts: SubscriberPoint[]) {
    if (!mapRef.current || pts.length === 0) return;
    mapRef.current.fitBounds(pts.map((p) => [p.lat, p.lon] as [number, number]), { padding: [50, 50], maxZoom: pts.length === 1 ? 15 : 14 });
  }

  // Vuelve a pintar al cambiar el zoom, los filtros o la ciudad marcada; encuadra todo cuando cambian los filtros.
  useEffect(() => {
    if (!listo || !mapRef.current) return;
    mapRef.current.on("zoomend", () => pintarRef.current());
  }, [listo]);
  useEffect(() => {
    if (!listo) return;
    pintar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, ciudades, ciudadSel]);
  useEffect(() => {
    if (!listo || !mapRef.current) return;
    mapRef.current.invalidateSize();
    if (enfoque.length) mapRef.current.fitBounds(enfoque.map((p) => [p.lat, p.lon] as [number, number]), { padding: [60, 60], maxZoom: 11 });
    setCiudadSel(null);
  }, [listo, enfoque]);

  if (points.length === 0) {
    return (
      <div className="grid place-items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong,var(--border))] bg-[var(--surface-2)]/50 px-6 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-[var(--accent)]/12 text-[var(--accent)]"><MapPin size={22} aria-hidden /></span>
        <p className="text-sm font-semibold">Aún no hay altas con ubicación</p>
        <p className="max-w-sm text-xs text-[var(--fg-muted)]">El mapa se llena solo con cada suscripción nueva: verás de qué ciudades llegan y qué tan precisa es su ubicación.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <div
          className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] shadow-inner"
          onClick={() => {
            if (rueda) return;
            setRueda(true);
            mapRef.current?.scrollWheelZoom.enable();
          }}
          onMouseLeave={() => {
            setRueda(false);
            mapRef.current?.scrollWheelZoom.disable();
          }}
        >
          <div ref={elRef} className="h-[22rem] w-full bg-[var(--surface-2)] sm:h-[28rem] lg:h-[30rem]" role="application" aria-label="Mapa de suscriptores del boletín" />
          {!listo && !fallo && <div aria-hidden className="absolute inset-0 animate-pulse bg-[var(--surface-2)]" />}
          {fallo && <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-[var(--fg-muted)]">No se pudo cargar el mapa. Revisa la conexión; el ranking de ciudades sigue disponible.</p>}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCiudadSel(null);
              if (visibles.length) mapRef.current?.fitBounds(visibles.map((p) => [p.lat, p.lon] as [number, number]), { padding: [60, 60], maxZoom: 11 });
            }}
            className="absolute right-3 top-3 z-[500] inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#1c2733] shadow-md ring-1 ring-black/5 transition hover:bg-white"
          >
            <Crosshair size={13} aria-hidden /> Ver todo
          </button>
          {!rueda && listo && (
            <span className="pointer-events-none absolute bottom-3 left-3 z-[500] inline-flex items-center gap-1.5 rounded-full bg-[#14284b]/85 px-3 py-1.5 text-xs font-medium text-white">
              <MousePointerClick size={13} aria-hidden /> Haz clic en el mapa para acercar con la rueda
            </span>
          )}
        </div>
        {/* Filtros por origen de la ubicación: quitan o ponen puntos del mapa y del ranking. */}
        <div role="group" aria-label="Origen de la ubicación" className="flex flex-wrap items-center gap-2">
          {ORIGENES.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={activos[o.id]}
              title={o.ayuda}
              onClick={() => setActivos((a) => ({ ...a, [o.id]: !a[o.id] }))}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${activos[o.id] ? "border-transparent bg-[var(--surface-2)] text-[var(--fg)]" : "border-[var(--border)] text-[var(--fg-muted)] line-through opacity-60"}`}
            >
              <span className="size-2.5 rounded-full" style={{ background: o.color }} aria-hidden />
              {o.nombre}
              <span className="tabular-nums text-[var(--fg-muted)]">{porOrigen[o.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <aside className="flex min-w-0 flex-col gap-4" aria-label="Resumen de ubicaciones">
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            [String(visibles.length), "suscriptores"],
            [String(ciudades.length), ciudades.length === 1 ? "ciudad" : "ciudades"],
            [points.length ? `${Math.round((precisos / points.length) * 100)}%` : "0%", "ubicación precisa"],
          ].map(([v, t]) => (
            <div key={t} className="rounded-[var(--radius)] bg-[var(--surface-2)] px-2 py-3">
              <dd className="lx-display text-2xl font-semibold tabular-nums leading-none">{v}</dd>
              <dt className="mt-1 text-[0.68rem] leading-tight text-[var(--fg-muted)]">{t}</dt>
            </div>
          ))}
        </dl>
        <div className="min-h-0">
          <p className="lx-kicker mb-2 text-[var(--fg-muted)]">Ciudades con más altas</p>
          {ciudades.length === 0 ? (
            <p className="text-sm text-[var(--fg-muted)]">Activa al menos un origen para ver ciudades.</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {ciudades.slice(0, 8).map((c, i) => {
                const n = c.puntos.length;
                const sel = ciudadSel === c.nombre;
                return (
                  <li key={c.nombre}>
                    <button
                      type="button"
                      aria-pressed={sel}
                      onClick={() => {
                        setCiudadSel(c.nombre);
                        acercar(c.puntos);
                      }}
                      className={`group w-full rounded-[var(--radius)] px-2.5 py-2 text-left transition hover:bg-[var(--surface-2)] ${sel ? "bg-[var(--accent)]/10" : ""}`}
                    >
                      <span className="flex items-baseline gap-2 text-sm">
                        <span className="w-4 shrink-0 text-xs tabular-nums text-[var(--fg-muted)]">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{c.nombre}{c.pais ? <span className="font-normal text-[var(--fg-muted)]"> · {c.pais}</span> : null}</span>
                        <span className="font-semibold tabular-nums">{n}</span>
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)] group-hover:bg-[var(--border)]">
                        <span className="block h-full rounded-full bg-[linear-gradient(90deg,#1f3f78,#2d5aa3)]" style={{ width: `${Math.max(6, (n / maxCiudad) * 100)}%` }} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          {ciudades.length > 8 && <p className="mt-2 px-2.5 text-xs text-[var(--fg-muted)]">y {ciudades.length - 8} ciudades más</p>}
        </div>
        <p className="mt-auto text-xs leading-relaxed text-[var(--fg-muted)]">
          Alejado, cada burbuja es una ciudad; acércate o pulsa una para ver a cada suscriptor. Las ubicaciones «Por IP» son aproximadas a la ciudad.
        </p>
      </aside>
    </div>
  );
}
