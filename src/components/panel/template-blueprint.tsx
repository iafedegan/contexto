"use client";

import { useState } from "react";
import type { HomeLayoutConfig } from "@/db/schema";
import { AD_ZONE_SPECS, type AdPosition } from "@/lib/ads-positions";
import { resolveParts } from "@/lib/template-parts";

export type AdState = "activo" | "borrador" | "vacio";
type View = "portada" | "seccion" | "nota";

const C = {
  img: "#dfe6c4",
  icon: "#b4c186",
  line: "#cdd4b0",
  head: "#8c9860",
  dark: "#33401a",
  darkSoft: "#4a5b26",
  band: "#eef2d9",
  rule: "#bccb8f",
  accent: "#556b2f",
};

const AD_LOOK: Record<AdState, { fill: string; stroke: string; text: string; dash?: string }> = {
  activo: { fill: "#cfe9b0", stroke: "#4f8a1f", text: "#2c5a10" },
  borrador: { fill: "#ffe7a8", stroke: "#c9a227", text: "#7a5d00" },
  vacio: { fill: "#fff8e1", stroke: "#d4b23a", text: "#8a7420", dash: "3 2" },
};

/**
 * Plano de la plantilla activa: dibuja la ARQUITECTURA real de la página
 * (cabecera, cuerpo propio de cada plantilla, barra lateral, pie) y marca en
 * ella dónde cae cada anuncio. No lleva etiquetas de código: son bloques de
 * foto y de texto como los de la página de verdad. Pulsar un anuncio abre su
 * formulario en la lista de debajo.
 */
export function TemplateBlueprint({
  layout,
  adStates,
  focus,
  onPick,
}: {
  layout: Required<HomeLayoutConfig>;
  adStates: Partial<Record<AdPosition, AdState>>;
  focus: AdPosition | null;
  onPick: (p: AdPosition) => void;
}) {
  const [view, setView] = useState<View>("portada");
  const parts = resolveParts(layout.templateId ?? "clasico", layout.parts);

  const els: React.ReactNode[] = [];
  let k = 0;
  const key = () => k++;
  const W = 360;
  const L = 20;
  const CW = 320;

  const rect = (x: number, y: number, w: number, h: number, fill: string, rx = 3, stroke?: string, op?: number) =>
    els.push(<rect key={key()} x={x} y={y} width={w} height={h} rx={rx} fill={fill} stroke={stroke} opacity={op} />);
  const img = (x: number, y: number, w: number, h: number, dark = false) => {
    rect(x, y, w, h, dark ? "#46583a" : C.img, 4);
    if (h >= 14 && w >= 14) {
      els.push(
        <g key={key()} opacity={0.9}>
          <circle cx={x + w * 0.72} cy={y + h * 0.28} r={Math.max(2, Math.min(w, h) * 0.07)} fill={dark ? "#7d8f45" : C.icon} />
          <path d={`M${x + w * 0.1},${y + h * 0.9} L${x + w * 0.4},${y + h * 0.45} L${x + w * 0.58},${y + h * 0.7} L${x + w * 0.72},${y + h * 0.55} L${x + w * 0.92},${y + h * 0.9} Z`} fill={dark ? "#7d8f45" : C.icon} />
        </g>,
      );
    }
  };
  const ln = (x: number, y: number, w: number, n = 1, fill = C.line, h = 3, gap = 6) => {
    for (let i = 0; i < n; i++) rect(x, y + i * gap, i === n - 1 && n > 1 ? w * 0.62 : w, h, fill, 1.5);
  };
  const head = (x: number, y: number, w: number, n = 1) => ln(x, y, w, n, C.head, 5, 8);
  const avatar = (cx: number, cy: number, r: number) => els.push(<circle key={key()} cx={cx} cy={cy} r={r} fill={C.icon} />);

  const ad = (pos: AdPosition, x: number, y: number, w: number, h: number) => {
    const st = adStates[pos] ?? "vacio";
    const look = AD_LOOK[st];
    const spec = AD_ZONE_SPECS[pos];
    const on = focus === pos;
    els.push(
      <g key={key()} onClick={() => onPick(pos)} className="cursor-pointer" role="button" aria-label={spec.where}>
        <title>{`${spec.where} · ${spec.width}×${spec.height} · ${st === "activo" ? "Activo" : st === "borrador" ? "Borrador" : "Vacío"}`}</title>
        <rect x={x} y={y} width={w} height={h} rx={3} fill={look.fill} stroke={on ? C.accent : look.stroke} strokeWidth={on ? 2.5 : 1.2} strokeDasharray={look.dash} />
        {h >= 14 && (
          <text x={x + w / 2} y={y + h / 2 + 2.5} textAnchor="middle" fontSize={h >= 20 ? 8 : 6.5} fontWeight={700} fill={look.text}>
            {`${spec.width}×${spec.height}`}
          </text>
        )}
      </g>,
    );
  };

  // ---------- cabecera y pie ----------
  const header = (y: number): number => {
    const centered = parts.navbar === "masthead" || parts.navbar === "couture" || parts.navbar === "crest";
    if (centered) {
      rect(L, y, CW, 50, C.band, 6, C.rule);
      rect(L + 8, y + 6, 50, 3, C.line, 1.5);
      rect(L + CW - 58, y + 6, 50, 3, C.line, 1.5);
      rect(L + CW / 2 - 55, y + 15, 110, 10, C.dark, 3);
      for (let i = 0; i < 6; i++) rect(L + 42 + i * 38, y + 35, 28, 4, C.head, 2);
      return 56;
    }
    if (parts.navbar === "glass") {
      rect(L + 20, y, CW - 40, 22, C.band, 11, C.rule);
      rect(L + 32, y + 9, 40, 4, C.dark, 2);
      for (let i = 0; i < 5; i++) rect(L + 110 + i * 34, y + 9, 24, 4, C.head, 2);
      return 30;
    }
    rect(L, y, CW, 28, C.band, 6, C.rule);
    rect(L + 8, y + 11, 50, 6, parts.navbar === "gremial" ? "#b23a2a" : C.dark, 2);
    for (let i = 0; i < 5; i++) rect(L + 100 + i * 38, y + 12, 28, 4, C.head, 2);
    return 34;
  };
  const ticker = (y: number): number => {
    rect(L, y, CW, 9, C.dark, 2);
    for (let i = 0; i < 4; i++) rect(L + 8 + i * 78, y + 3, 60, 3, "#9fb04a", 1.5);
    return 15;
  };
  const footer = (y: number): number => {
    rect(L, y, CW, 66, C.dark, 6);
    if (parts.footer === "atelier" || parts.footer === "seal" || parts.footer === "aurora") {
      rect(L + CW / 2 - 40, y + 12, 80, 6, "#cfd9a0", 2);
      for (let i = 0; i < 5; i++) rect(L + 60 + i * 44, y + 32, 34, 3, "#8fa04a", 1.5);
      rect(L + CW / 2 - 60, y + 48, 120, 3, "#6d7e3a", 1.5);
    } else {
      for (let c = 0; c < 4; c++) {
        rect(L + 14 + c * 76, y + 12, 44, 4, "#cfd9a0", 2);
        for (let r = 0; r < 3; r++) rect(L + 14 + c * 76, y + 24 + r * 9, 56, 3, "#7d8f45", 1.5);
      }
    }
    return 72;
  };

  // ---------- bloques reutilizables ----------
  const card = (x: number, y: number, w: number, ih: number, nl = 2): number => {
    img(x, y, w, ih);
    ln(x, y + ih + 5, w, nl, C.head, 3.5, 6);
    return ih + 7 + nl * 6;
  };

  // ---------- cuerpos de cada plantilla (portada) ----------
  const bodyEsmeralda = (x: number, y: number, w: number): number => {
    const lw = w * 0.6, rw = w - lw - 12;
    img(x, y, lw, 84);
    head(x, y + 92, lw, 2);
    ln(x, y + 112, lw, 2);
    head(x + lw + 12, y, rw * 0.7);
    for (let i = 0; i < 3; i++) {
      img(x + lw + 12, y + 12 + i * 34, 24, 24);
      ln(x + lw + 42, y + 14 + i * 34, rw - 30, 3, C.line, 3, 7);
    }
    const y2 = y + 128;
    head(x, y2, w * 0.3);
    const cw = (w - 16) / 3;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) card(x + c * (cw + 8), y2 + 12 + r * 64, cw, 34);
    return 128 + 12 + 2 * 64;
  };
  const bodyClasico = (x: number, y: number, w: number): number => {
    let h: number;
    if (layout.breveDirection === "horizontal") {
      img(x, y, w, 78);
      head(x, y + 86, w * 0.7, 2);
      img(x, y + 108, w, 46);
      ln(x, y + 160, w * 0.8, 2);
      const yb = y + 180;
      rect(x, yb, w, 2, C.dark, 1);
      const cols = layout.breveColumns ?? 2;
      const cw = (w - (cols - 1) * 8) / cols;
      for (let c = 0; c < cols; c++) for (let r = 0; r < 2; r++) ln(x + c * (cw + 8), yb + 10 + r * 22, cw, 3, C.line, 3, 6);
      h = 180 + 12 + 2 * 22 + 8;
    } else {
      const lw = w * 0.62, rw = w - lw - 14;
      img(x, y, lw, 66);
      head(x, y + 74, lw, 2);
      ln(x, y + 94, lw, 2);
      img(x, y + 112, lw, 44);
      head(x, y + 162, lw, 1);
      rect(x + lw + 6, y, 1.5, 172, C.rule, 0);
      rect(x + lw + 14, y, rw, 2, C.dark, 1);
      for (let i = 0; i < 6; i++) {
        head(x + lw + 14, y + 10 + i * 27, rw, 1);
        ln(x + lw + 14, y + 20 + i * 27, rw, 2);
      }
      h = 176;
    }
    const y2 = y + h + 8;
    rect(x, y2, w, 2, C.dark, 1);
    const cw = (w - 16) / 3;
    for (let c = 0; c < 3; c++) card(x + c * (cw + 8), y2 + 12, cw, 30);
    return h + 8 + 12 + 66;
  };
  const bodyRevista = (x: number, y: number, w: number): number => {
    img(x, y, w, 104, true);
    rect(x, y + 66, w, 38, C.dark, 4, undefined, 0.88);
    rect(x + 8, y + 72, w * 0.6, 5, "#e6efc4", 2);
    rect(x + 8, y + 82, w * 0.4, 4, "#9fb04a", 2);
    for (let i = 0; i < 4; i++) els.push(<circle key={key()} cx={x + w / 2 - 12 + i * 8} cy={y + 96} r={1.8} fill={i === 0 ? "#fff" : "#8fa04a"} />);
    const y2 = y + 116;
    rect(x, y2, w, 2, C.rule, 1);
    head(x, y2 + 8, w * 0.25);
    const cw = (w - 3 * 6) / 4;
    for (let c = 0; c < 4; c++) card(x + c * (cw + 6), y2 + 22, cw, 30, 2);
    els.push(<circle key={key()} cx={x + 6} cy={y2 + 37} r={6} fill="#fff" stroke={C.rule} />, <circle key={key()} cx={x + w - 6} cy={y2 + 37} r={6} fill="#fff" stroke={C.rule} />);
    const y3 = y2 + 80;
    rect(x, y3, w, 2, C.rule, 1);
    head(x, y3 + 8, w * 0.3);
    const rw3 = (w - 16) / 3;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) card(x + c * (rw3 + 8), y3 + 22 + r * 66, rw3, 38);
    return 116 + 80 + 22 + 2 * 66;
  };
  const bodyCompacto = (x: number, y: number, w: number): number => {
    ln(x, y + 2, w * 0.45, 1, C.head, 3.5);
    for (let i = 0; i < 3; i++) rect(x + w - 24 - i * 26, y, 22, 8, C.band, 4, C.rule);
    rect(x, y + 14, w, 1.5, C.rule, 0);
    const cols = Math.min(Math.max(layout.breveColumns ?? 4, 2), 4);
    const cw = (w - (cols - 1) * 5) / cols;
    const rows = 7;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const cx = x + c * (cw + 5), cy = y + 22 + r * 34;
        rect(cx, cy, cw, 30, "#fff", 4, C.rule);
        img(cx + 3, cy + 3, 22, 24);
        ln(cx + 29, cy + 6, cw - 33, 3, C.head, 3, 7);
      }
    return 22 + rows * 34;
  };
  const bodyVanguardia = (x: number, y: number, w: number): number => {
    const u = (w - 5 * 4) / 6, rh = 36;
    const tiles: [number, number, number, number][] = [[0, 0, 4, 2], [4, 0, 2, 1], [4, 1, 2, 1], [0, 2, 2, 1], [2, 2, 2, 1], [4, 2, 2, 1], [0, 3, 3, 1], [3, 3, 3, 1], [0, 4, 2, 1], [2, 4, 2, 1], [4, 4, 2, 1]];
    for (const [c, r, cs, rs] of tiles) {
      const tx = x + c * (u + 4), ty = y + r * (rh + 4), tw = cs * u + (cs - 1) * 4, th = rs * rh + (rs - 1) * 4;
      rect(tx, ty, tw, th, "#3a4b2a", 9);
      img(tx + 3, ty + 3, tw - 6, th - 6, true);
      rect(tx + 6, ty + th - 14, tw * 0.6, 3.5, "#e6efc4", 2);
      rect(tx + 6, ty + th - 8, tw * 0.4, 3, "#9fb04a", 2);
    }
    return 5 * (rh + 4);
  };
  const bodyGremial = (x: number, y: number, w: number): number => {
    const lw = w * 0.63;
    img(x, y, lw, 92, true);
    rect(x, y + 58, lw, 34, C.dark, 4, undefined, 0.85);
    rect(x + 6, y + 65, lw * 0.7, 5, "#e6efc4", 2);
    rect(x + 6, y + 75, lw * 0.45, 4, "#9fb04a", 2);
    for (let i = 0; i < 3; i++) {
      img(x + lw + 8, y + i * 32, 30, 28);
      ln(x + lw + 44, y + 3 + i * 32, w - lw - 52, 3, C.head, 3, 7);
    }
    const y2 = y + 106;
    head(x, y2, w * 0.3);
    const cw = (w - 4 * 5) / 5;
    for (let c = 0; c < 5; c++) card(x + c * (cw + 5), y2 + 12, cw, 26, 2);
    const y3 = y2 + 66;
    rect(x, y3, w, 70, C.band, 8);
    head(x + 8, y3 + 8, w * 0.3);
    for (let c = 0; c < 2; c++) {
      avatar(x + 16 + c * (w / 2), y3 + 34, 9);
      ln(x + 30 + c * (w / 2), y3 + 28, w / 2 - 42, 3, C.head, 3, 7);
    }
    const y4 = y3 + 82;
    const cw3 = (w - 16) / 3;
    for (let c = 0; c < 3; c++) card(x + c * (cw3 + 8), y4, cw3, 34);
    return 106 + 66 + 82 + 34 + 20;
  };

  // ---------- barra lateral ----------
  const sidebar = (x: number, y: number, w: number): number => {
    let yy = y;
    head(x, yy, w * 0.8);
    yy += 12;
    for (let i = 0; i < 4; i++) {
      rect(x, yy + i * 17, 8, 8, C.head, 2);
      ln(x + 12, yy + i * 17 + 1, w - 12, 2, C.line, 3, 6);
    }
    yy += 4 * 17 + 6;
    ad("sidebar_top", x, yy, w, (w * 250) / 300);
    yy += (w * 250) / 300 + 8;
    rect(x, yy, w, 44, C.band, 5, C.rule);
    head(x + 5, yy + 6, w - 10);
    rect(x + 5, yy + 16, w - 10, 8, "#fff", 3, C.rule);
    rect(x + 5, yy + 28, w - 10, 9, C.accent, 3);
    yy += 52;
    for (let i = 0; i < 4; i++) els.push(<circle key={key()} cx={x + 7 + i * 17} cy={yy + 6} r={6} fill="none" stroke={C.rule} />);
    yy += 20;
    ad("sidebar_bottom", x, yy, w, (w * 250) / 300);
    yy += (w * 250) / 300 + 8;
    ad("sidebar_sticky", x, yy, w, w * 2);
    yy += w * 2;
    return yy - y;
  };

  // ---------- vistas ----------
  let y = 8;
  if (view === "portada") {
    y += header(y);
    y += ticker(y) + 4;
    ad("home_top", L, y, CW, 24);
    y += 32;
    if (parts.body === "clasico") {
      for (let i = 0; i < 4; i++) {
        img(L + i * 80, y, 74, 26);
      }
      y += 36;
    }
    const mainW = 232, sideX = L + mainW + 12, sideW = CW - mainW - 12;
    let mh = 0;
    switch (parts.body) {
      case "esmeralda": mh = bodyEsmeralda(L, y, mainW); break;
      case "revista": mh = bodyRevista(L, y, mainW); break;
      case "compacto": mh = bodyCompacto(L, y, mainW); break;
      case "vanguardia": mh = bodyVanguardia(L, y, mainW); break;
      case "gremial": mh = bodyGremial(L, y, mainW); break;
      default: mh = bodyClasico(L, y, mainW);
    }
    ad("home_billboard", L, y + mh + 14, mainW, (mainW * 250) / 970);
    mh += 14 + (mainW * 250) / 970;
    const sh = sidebar(sideX, y, sideW);
    y += Math.max(mh, sh) + 14;
    ad("home_bottom", L, y, CW, 24);
    y += 32;
    rect(L, y, CW, 36, C.band, 8, C.rule);
    head(L + CW / 2 - 50, y + 10, 100);
    rect(L + CW / 2 - 24, y + 22, 48, 8, C.accent, 4);
    y += 46;
    ad("footer", L, y, CW, 24);
    y += 32;
    y += footer(y);
  } else if (view === "seccion") {
    y += header(y);
    y += 6;
    const centered = layout.templateId === "clasico";
    const pos = layout.sectionFilters ?? "cabecera";
    ln(centered ? L + CW / 2 - 30 : L, y, 60, 1, C.line, 3);
    y += 12;
    head(centered ? L + CW / 2 - 18 : L, y, 36);
    y += 12;
    rect(centered ? L + CW / 2 - 90 : L, y, 180, 14, C.dark, 3);
    const filterBlock = (x: number, yy: number, w: number): number => {
      for (let i = 0; i < 4; i++) rect(x + i * ((w - 6) / 4 + 2), yy, (w - 6) / 4, 9, i === 0 ? "#cfa84a" : "#fff", 5, C.rule);
      rect(x, yy + 14, w * 0.34, 10, "#fff", 3, C.rule);
      rect(x + w * 0.36, yy + 14, w * 0.24, 10, "#fff", 3, C.rule);
      rect(x + w * 0.62, yy + 14, w * 0.24, 10, "#fff", 3, C.rule);
      rect(x + w * 0.88, yy + 14, w * 0.12, 10, "#cfa84a", 5);
      return 28;
    };
    if (pos === "cabecera") filterBlock(L + CW - 150, y - 4, 150);
    y += 24;
    ln(centered ? L + CW / 2 - 70 : L, y, 140, 2, C.line, 3, 7);
    y += 22;
    if (pos === "izquierda") { filterBlock(L, y, 170); y += 36; }
    if (pos === "centro") { filterBlock(L + CW / 2 - 85, y, 170); y += 36; }
    if (pos === "derecha") { filterBlock(L + CW - 170, y, 170); y += 36; }
    if (pos === "barra") {
      rect(L, y, CW, 26, C.band, 8, C.rule);
      for (let i = 0; i < 4; i++) rect(L + 8 + i * 30, y + 9, 26, 8, i === 0 ? "#cfa84a" : "#fff", 4, C.rule);
      rect(L + 134, y + 7, 62, 12, "#fff", 3, C.rule);
      rect(L + 200, y + 7, 46, 12, "#fff", 3, C.rule);
      rect(L + 250, y + 7, 46, 12, "#fff", 3, C.rule);
      rect(L + 300, y + 7, 14, 12, "#cfa84a", 6);
      y += 36;
    }
    ad("section_top", L, y, CW, 24);
    y += 34;
    const cw = (CW - 16) / 3;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) card(L + c * (cw + 8), y + r * 78, cw, 46, 2);
    y += 2 * 78 + 4;
    for (let i = 0; i < 5; i++) els.push(<circle key={key()} cx={L + CW / 2 - 40 + i * 20} cy={y + 8} r={7} fill={i === 0 ? C.accent : "#fff"} stroke={C.rule} />);
    y += 26;
    ad("section_bottom", L, y, CW, 24);
    y += 32;
    ad("footer", L, y, CW, 24);
    y += 32;
    y += footer(y);
  } else {
    y += header(y);
    y += 8;
    ln(L, y, 90, 1, C.line, 3);
    y += 12;
    rect(L, y, CW * 0.85, 9, C.dark, 3);
    rect(L, y + 14, CW * 0.6, 9, C.dark, 3);
    y += 34;
    ln(L, y, CW * 0.8, 2, C.line, 3, 7);
    y += 20;
    avatar(L + 8, y + 6, 8);
    ln(L + 22, y, 70, 2, C.head, 3, 7);
    y += 24;
    img(L, y, CW, 104);
    y += 114;
    ad("article_top", L, y, CW, 24);
    y += 34;
    ln(L + 20, y, CW - 40, 6, C.line, 3.5, 8);
    y += 56;
    head(L + 20, y, 120);
    y += 14;
    ln(L + 20, y, CW - 40, 5, C.line, 3.5, 8);
    y += 46;
    ad("article_sidebar", L + CW / 2 - 55, y, 110, 92);
    y += 104;
    for (let i = 0; i < 4; i++) rect(L + i * 44, y, 38, 9, C.band, 5, C.rule);
    y += 22;
    ad("footer", L, y, CW, 24);
    y += 32;
    y += footer(y);
  }

  const H = y + 8;
  const tabs: [View, string][] = [["portada", "Portada"], ["seccion", "Sección"], ["nota", "Nota"]];

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-pressed={view === id}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${view === id ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)] bg-white hover:border-[var(--accent)]"}`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[0.68rem] text-[var(--fg-muted)]">Plano de la plantilla activa</span>
      </div>
      <div className="max-h-[34rem] overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-white">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Plano de la plantilla con la posición de la publicidad" fontFamily="Inter, Helvetica, Arial, sans-serif">
          {els}
        </svg>
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[0.68rem] text-[var(--fg-muted)]">
        <span><span className="mr-1 inline-block size-2.5 rounded-sm border border-dashed border-[#d4b23a] bg-[#fff8e1]" />Vacío</span>
        <span><span className="mr-1 inline-block size-2.5 rounded-sm border border-[#c9a227] bg-[#ffe7a8]" />Borrador</span>
        <span><span className="mr-1 inline-block size-2.5 rounded-sm border border-[#4f8a1f] bg-[#cfe9b0]" />Activo</span>
        <span>· Pulsa un anuncio para editarlo</span>
      </p>
    </div>
  );
}
