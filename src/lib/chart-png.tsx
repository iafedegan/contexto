import "server-only";
import { ImageResponse } from "next/og";
import type { ChartSpec } from "@/lib/chart-svg";

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const COL = ["#2dd4bf", "#a78bfa", "#f472b6", "#fbbf24"];

/**
 * Imagen PNG (1200×675) de una gráfica para mandarla por Telegram. Se dibuja con el motor de imágenes de Next
 * (`next/og`), que trae su propia tipografía: el SVG interactivo del sitio necesitaría fuentes del sistema que en
 * el servidor no existen. Es una vista simplificada (barras proporcionales para cualquier tipo); la gráfica
 * interactiva completa queda en la nota.
 */
export async function graficaPng(c: ChartSpec): Promise<Uint8Array> {
  const filas = c.labels.map((l, i) => ({ l, v: c.series[0].values[i] ?? 0 }));
  const max = Math.max(1, ...filas.map((f) => Math.abs(f.v)));
  const total = filas.reduce((a, f) => a + f.v, 0) || 1;
  const pie = c.type === "pie";
  const mayor = filas.reduce((a, f) => (f.v > a.v ? f : a), filas[0]);
  const kpi = pie ? `${Math.round((mayor.v / total) * 100)} %` : nf.format(mayor.v);
  const alto = Math.min(52, Math.floor(430 / Math.max(filas.length, 1)));

  const img = new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 48, color: "#fff", background: "linear-gradient(135deg,#0d0f33,#232a78)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 800 }}>
            <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.15 }}>{c.title}</div>
            <div style={{ fontSize: 22, color: "rgba(255,255,255,.65)", marginTop: 8 }}>{c.unit}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontSize: 64, fontWeight: 800, color: "#2dd4bf" }}>{kpi}</div>
            <div style={{ fontSize: 20, color: "rgba(255,255,255,.65)" }}>{mayor.l.slice(0, 28)}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, flex: 1, justifyContent: "center" }}>
          {filas.slice(0, 9).map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", height: alto }}>
              <div style={{ width: 250, fontSize: 22, textAlign: "right", paddingRight: 18, color: "rgba(255,255,255,.9)" }}>{f.l.slice(0, 22)}</div>
              <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
                <div style={{ display: "flex", height: alto - 14, width: `${Math.max(2, (Math.abs(f.v) / max) * 84)}%`, borderRadius: 10, background: `linear-gradient(90deg,${COL[i % 4]},#22d3ee)` }} />
                <div style={{ fontSize: 22, fontWeight: 700, marginLeft: 12 }}>{pie ? `${Math.round((f.v / total) * 100)} %` : nf.format(f.v)}</div>
              </div>
            </div>
          ))}
        </div>
        {c.source ? <div style={{ fontSize: 17, color: "rgba(255,255,255,.55)" }}>{`Fuente: ${c.source.slice(0, 120)}`}</div> : null}
      </div>
    ),
    { width: 1200, height: 675 },
  );
  return new Uint8Array(await img.arrayBuffer());
}
