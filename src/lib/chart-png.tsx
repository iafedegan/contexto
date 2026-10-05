import "server-only";
import { ImageResponse } from "next/og";
import type { ChartSpec } from "@/lib/chart-svg";
import { nfCO1 as nf } from "@/lib/format";

// Colores de las series: turquesa, violeta, rosa y ámbar.
const COL = ["#2dd4bf", "#a78bfa", "#f472b6", "#fbbf24"];
// Segundo color de cada serie, para los degradados.
const COL2 = ["#22d3ee", "#6366f1", "#fb7185", "#f97316"];
// Colores de los sectores de la torta (hasta ocho).
const PIE = ["#2dd4bf", "#a78bfa", "#f472b6", "#fbbf24", "#38bdf8", "#fb7185", "#a3e635", "#94a3b8"];
// Ancho útil de la gráfica dentro de la imagen de 1200 píxeles.
const W = 1104; // ancho útil (1200 − 2×48)

/**
 * Imagen PNG (1200×675) de una gráfica para mandarla por Telegram y para insertarla en la nota. Se dibuja con el
 * motor de imágenes de Next (`next/og`), que trae su propia tipografía: el SVG interactivo del sitio necesitaría
 * fuentes del sistema que en el servidor no existen. Respeta el tipo elegido: barras verticales u horizontales,
 * histograma, líneas, área, torta y dona. Los textos van en divs; los SVG internos solo dibujan formas.
 */
export async function graficaPng(c: ChartSpec): Promise<Uint8Array> {
  const filas = c.labels.map((l, i) => ({ l, v: c.series[0].values[i] ?? 0 }));
  const total = filas.reduce((a, f) => a + Math.max(0, f.v), 0) || 1;
  const pie = c.type === "pie";
  const linea = c.type === "line";
  const mayor = linea ? filas[filas.length - 1] : filas.reduce((a, f) => (f.v > a.v ? f : a), filas[0]);
  const kpi = pie ? `${Math.round((Math.max(0, mayor.v) / total) * 100)} %` : nf.format(mayor.v);
  const horizontal = c.type === "bar" && (c.variant === "horizontal" || (c.variant !== "vertical" && c.variant !== "histograma" && (c.labels.some((l) => l.length > 14) || c.labels.length > 7)));

  const cuerpo = pie ? <Torta c={c} filas={filas} total={total} /> : linea ? <Lineas c={c} /> : horizontal ? <BarrasH filas={filas} /> : <BarrasV filas={filas} histograma={c.variant === "histograma"} />;

  const img = new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 48, color: "#fff", background: "linear-gradient(135deg,#0d0f33,#232a78)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 800 }}>
            <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.15 }}>{c.title}</div>
            <div style={{ fontSize: 22, color: "rgba(255,255,255,.65)", marginTop: 8 }}>{c.unit}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontSize: 60, fontWeight: 800, color: "#2dd4bf" }}>{kpi}</div>
            <div style={{ fontSize: 20, color: "rgba(255,255,255,.65)" }}>{mayor.l.slice(0, 28)}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 16, flex: 1, justifyContent: "center" }}>{cuerpo}</div>
        {c.source ? <div style={{ display: "flex", fontSize: 17, color: "rgba(255,255,255,.55)" }}>{`Fuente: ${c.source.slice(0, 130)}`}</div> : null}
      </div>
    ),
    { width: 1200, height: 675 },
  );
  return new Uint8Array(await img.arrayBuffer());
}

// Un dato de la gráfica: etiqueta y valor.
type Fila = { l: string; v: number };

// Barras horizontales (hasta 9 filas), con el alto de cada barra ajustado al espacio disponible.
function BarrasH({ filas }: { filas: Fila[] }) {
  const f9 = filas.slice(0, 9);
  const max = Math.max(1, ...f9.map((f) => Math.abs(f.v)));
  const alto = Math.min(52, Math.floor(400 / Math.max(f9.length, 1)));
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {f9.map((f, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", height: alto }}>
          <div style={{ display: "flex", width: 250, fontSize: 22, justifyContent: "flex-end", paddingRight: 18, color: "rgba(255,255,255,.9)" }}>{f.l.slice(0, 22)}</div>
          <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
            <div style={{ display: "flex", height: alto - 14, width: `${Math.max(2, (Math.abs(f.v) / max) * 80)}%`, borderRadius: 10, background: `linear-gradient(90deg,${COL[i % 4]},${COL2[i % 4]})` }} />
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700, marginLeft: 12 }}>{nf.format(f.v)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Barras verticales (hasta 12) o histograma, cuando van pegadas.
function BarrasV({ filas, histograma }: { filas: Fila[]; histograma: boolean }) {
  const f = filas.slice(0, 12);
  const max = Math.max(1, ...f.map((x) => Math.abs(x.v)));
  const AREA = 290;
  return (
    <div style={{ display: "flex", flexDirection: "column", width: W }}>
      <div style={{ display: "flex", alignItems: "flex-end", height: AREA + 34, borderBottom: "2px solid rgba(255,255,255,.3)", gap: histograma ? 2 : 16 }}>
        {f.map((x, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{nf.format(x.v)}</div>
            <div style={{ display: "flex", width: histograma ? "100%" : "72%", height: Math.max(3, Math.round((Math.abs(x.v) / max) * AREA)), borderRadius: histograma ? 2 : 10, background: `linear-gradient(180deg,${COL[i % 4]},${COL2[i % 4]})` }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: histograma ? 2 : 16, marginTop: 8 }}>
        {f.map((x, i) => (
          <div key={i} style={{ display: "flex", flex: 1, justifyContent: "center", textAlign: "center", fontSize: 18, color: "rgba(255,255,255,.85)" }}>{x.l.slice(0, f.length > 8 ? 9 : 14)}</div>
        ))}
      </div>
    </div>
  );
}

// Líneas o área de hasta cuatro series dibujadas en SVG, con la escala ajustada a los datos.
function Lineas({ c }: { c: ChartSpec }) {
  const n = c.labels.length;
  const H = 290;
  const series = c.series.slice(0, 4);
  const todos = series.flatMap((s) => s.values);
  const area = c.variant === "area";
  const minV = Math.min(...todos), maxV = Math.max(...todos);
  // La línea no necesita partir de cero (así se aprecia la variación); el área sí, porque su volumen se lee desde la base.
  const lo = area ? Math.min(0, minV) : minV - (maxV - minV || Math.abs(maxV) || 1) * 0.25;
  const hi = area ? Math.max(1, maxV) : maxV + (maxV - minV || Math.abs(maxV) || 1) * 0.15;
  // Posición horizontal del punto i, centrado en su columna.
  const x = (i: number) => ((i + 0.5) * W) / n;
  // Posición vertical de un valor según la escala, con margen arriba y abajo.
  const y = (v: number) => 14 + (1 - (v - lo) / (hi - lo || 1)) * (H - 28);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: W }}>
      <svg xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {[0, 1, 2, 3].map((k) => <line key={k} x1={0} x2={W} y1={14 + (k * (H - 28)) / 3} y2={14 + (k * (H - 28)) / 3} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />)}
        {series.map((s, si) => {
          const pts = s.values.slice(0, n).map((v, i) => `${x(i)},${y(v)}`);
          return (
            <g key={si}>
              {area && si === 0 ? <polygon points={`${x(0)},${y(Math.max(0, lo))} ${pts.join(" ")} ${x(s.values.slice(0, n).length - 1)},${y(Math.max(0, lo))}`} fill="rgba(45,212,191,0.28)" /> : null}
              <polyline points={pts.join(" ")} fill="none" stroke={COL[si % 4]} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.slice(0, n).map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={7} fill="#0d0f33" stroke={COL[si % 4]} strokeWidth={4} />)}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", marginTop: 6 }}>
        {c.labels.map((l, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, textAlign: "center" }}>
            <div style={{ display: "flex", fontSize: 18, color: "rgba(255,255,255,.85)" }}>{l.slice(0, n > 8 ? 8 : 14)}</div>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700 }}>{nf.format(series[0].values[i] ?? 0)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Torta o dona: reparte el círculo en sectores proporcionales (hasta ocho).
function Torta({ c, filas, total }: { c: ChartSpec; filas: Fila[]; total: number }) {
  const f = filas.filter((x) => x.v > 0).slice(0, 8);
  const R = 170, cx = 180, cy = 180, ri = c.variant === "dona" ? 100 : 0;
  const acum = f.reduce<number[]>((a, x) => [...a, (a[a.length - 1] ?? 0) + x.v / total], []);
  // Punto de la circunferencia para un radio y un ángulo, como texto de coordenadas SVG.
  const pt = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  // Un sector por dato, con su ángulo inicial y final y la forma del arco.
  const trozos = f.map((x, i) => {
    const da = Math.min((x.v / total) * Math.PI * 2, Math.PI * 2 - 0.001);
    const a0 = -Math.PI / 2 + (i === 0 ? 0 : acum[i - 1]) * Math.PI * 2, a1 = a0 + da;
    const g = da > Math.PI ? 1 : 0;
    const d = ri
      ? `M ${pt(R, a0)} A ${R} ${R} 0 ${g} 1 ${pt(R, a1)} L ${pt(ri, a1)} A ${ri} ${ri} 0 ${g} 0 ${pt(ri, a0)} Z`
      : `M ${cx} ${cy} L ${pt(R, a0)} A ${R} ${R} 0 ${g} 1 ${pt(R, a1)} Z`;
    return <path key={i} d={d} fill={PIE[i % 8]} stroke="#0d0f33" strokeWidth={3} />;
  });
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 56 }}>
      <div style={{ display: "flex", position: "relative", width: 360, height: 360 }}>
        <svg xmlns="http://www.w3.org/2000/svg" width={360} height={360} viewBox="0 0 360 360">{trozos}</svg>
        {ri ? (
          <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: 360, height: 360, alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>{nf.format(total)}</div>
            <div style={{ display: "flex", fontSize: 18, color: "rgba(255,255,255,.65)" }}>total</div>
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 560 }}>
        {f.map((x, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", width: 22, height: 22, borderRadius: 6, background: PIE[i % 8], marginRight: 14 }} />
            <div style={{ display: "flex", flex: 1, fontSize: 24 }}>{x.l.slice(0, 26)}</div>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, marginLeft: 12 }}>{`${Math.round((x.v / total) * 100)} %`}</div>
            <div style={{ display: "flex", fontSize: 20, color: "rgba(255,255,255,.65)", marginLeft: 12, width: 110, justifyContent: "flex-end" }}>{nf.format(x.v)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
