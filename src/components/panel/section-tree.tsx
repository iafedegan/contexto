"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Loader2, Maximize2, Network, Plus, Trash2, X } from "lucide-react";
import { SeccionForm } from "@/components/panel/seccion-form";
import { NAV_VISIBLE } from "@/lib/nav-limits";
import {
  crearSeccion,
  eliminarSeccion,
  moverSeccion,
  ordenarSeccion,
  type EstructuraResult,
} from "@/app/panel/(app)/secciones/actions";

export type SectionNode = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  articleCount: number;
  parentId: string | null;
};

type Branch = { node: SectionNode; kids: SectionNode[] };

/** Respeta el orden que llega del servidor: es el MISMO de la barra del sitio (orden y nombre). */
function buildTree(sections: SectionNode[]): Branch[] {
  const ids = new Set(sections.map((s) => s.id));
  const roots = sections.filter((s) => !s.parentId || !ids.has(s.parentId));
  return roots.map((r) => ({ node: r, kids: sections.filter((s) => s.parentId === r.id) }));
}

/**
 * Las secciones del menú como árbol: el menú principal arriba, cada sección
 * debajo y, colgando de ella, sus subsecciones. Se puede ver compacto (en la
 * barra lateral) o en grande, de izquierda a derecha, con el detalle al lado.
 */
export function SectionTree({ sections, onSaved }: { sections: SectionNode[]; onSaved: () => void }) {
  const tree = useMemo(() => buildTree(sections), [sections]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [wide, setWide] = useState(false);
  const [msg, setMsg] = useState<EstructuraResult | null>(null);
  const [busy, startBusy] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const sel = sections.find((s) => s.id === selected) ?? null;

  /** Ejecuta un cambio de estructura, muestra el resultado y refresca. */
  function run(p: () => Promise<EstructuraResult>) {
    setMsg(null);
    startBusy(async () => {
      try {
        const r = await p();
        setMsg(r);
        if (r.ok) onSaved();
      } catch {
        setMsg({ ok: false, message: "No se pudo completar (¿tu rol lo permite?)." });
      }
    });
  }
  function drop(targetId: string | null) {
    const id = dragId;
    setDragId(null);
    setOver(null);
    if (id && id !== targetId) run(() => moverSeccion(id, targetId));
  }
  const draggedHasKids = !!dragId && (tree.find((b) => b.node.id === dragId)?.kids.length ?? 0) > 0;
  const dnd = (id: string | null, canDrop: boolean) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragId || !canDrop) return;
      e.preventDefault();
      setOver(id ?? "root");
    },
    onDragLeave: () => setOver((o) => (o === (id ?? "root") ? null : o)),
    onDrop: (e: React.DragEvent) => {
      if (!canDrop) return;
      e.preventDefault();
      drop(id);
    },
  });

  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bar = tree.slice(0, NAV_VISIBLE);
  const more = tree.slice(NAV_VISIBLE);

  const renderBranch = ({ node, kids }: Branch, pos: number | null) => {
    const isOpen = open.has(node.id);
    return (
      <li key={node.id} className="relative pl-5 pt-1.5">
        <span aria-hidden className="absolute left-0 top-[1.15rem] h-0.5 w-5 bg-[var(--border-strong)]/50" />
        <div
          className={`flex items-center gap-1 rounded-full ${over === node.id ? "ring-2 ring-[#c9a227] ring-offset-2" : ""}`}
          draggable
          onDragStart={() => setDragId(node.id)}
          onDragEnd={() => {
            setDragId(null);
            setOver(null);
          }}
          {...dnd(node.id, dragId !== node.id && !draggedHasKids)}
        >
          {kids.length > 0 ? (
            <button type="button" onClick={() => toggle(node.id)} aria-label={isOpen ? "Contraer" : "Expandir"} className="grid size-6 place-items-center rounded-full hover:bg-[var(--surface-2)]">
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="size-6" />
          )}
          {pos !== null && <span className="w-4 text-center text-[0.65rem] font-bold text-[var(--fg-muted)]">{pos}</span>}
          <NodePill s={node} level={1} active={selected === node.id} onClick={() => setSelected(node.id)} extra={kids.length ? `${kids.length} sub` : undefined} />
        </div>
        {isOpen && kids.length > 0 && (
          <ul className="ml-[0.7rem] mt-1 border-l-2 border-[var(--border)] pl-0">
            {kids.map((k) => (
              <li key={k.id} className="relative pl-5 pt-1">
                <span aria-hidden className="absolute left-0 top-[0.95rem] h-0.5 w-5 bg-[var(--border)]" />
                <div
                  draggable
                  onDragStart={() => setDragId(k.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOver(null);
                  }}
                  className="inline-block"
                >
                  <NodePill s={k} level={2} active={selected === k.id} onClick={() => setSelected(k.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(new Set([...tree.filter((b) => b.kids.length).map((b) => b.node.id), "__mas"]))} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold hover:border-[var(--accent)]">
          Expandir todo
        </button>
        <button type="button" onClick={() => setOpen(new Set())} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold hover:border-[var(--accent)]">
          Contraer
        </button>
        <button type="button" onClick={() => setWide(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent-fg)]">
          <Maximize2 size={12} /> Ver árbol completo
        </button>
      </div>

      {/* Árbol compacto: calcado de la barra del sitio */}
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-3">
        <div
          {...dnd(null, true)}
          title="Suelta aquí una sección para volverla principal"
          className={`inline-flex items-center gap-2 rounded-full bg-[#33401a] px-3 py-1.5 text-xs font-bold text-white ${over === "root" ? "ring-2 ring-[#c9a227] ring-offset-2" : ""}`}
        >
          <Network size={13} /> Barra del sitio
          <span className="rounded-full bg-white/20 px-1.5 text-[0.65rem]">{bar.length + (more.length ? 2 : 1)}</span>
        </div>
        <ul className="ml-4 border-l-2 border-[var(--border-strong)]/50 pl-0">
          {bar.map((b, i) => renderBranch(b, i + 1))}
          <li className="relative pl-5 pt-1.5">
            <span aria-hidden className="absolute left-0 top-[1.15rem] h-0.5 w-5 bg-[var(--border-strong)]/50" />
            <span className="ml-7 inline-flex items-center rounded-full border border-dashed border-[var(--border-strong)] px-3 py-1 text-xs font-semibold text-[var(--fg-muted)]">Buscar · fijo</span>
          </li>
          {more.length > 0 && (
            <li className="relative pl-5 pt-1.5">
              <span aria-hidden className="absolute left-0 top-[1.15rem] h-0.5 w-5 bg-[var(--border-strong)]/50" />
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => toggle("__mas")} aria-label="Mostrar menú Más" className="grid size-6 place-items-center rounded-full hover:bg-[var(--surface-2)]">
                  {open.has("__mas") ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <span className="inline-flex items-center gap-2 rounded-full border-2 border-[#33401a] bg-[#eef2d9] px-3 py-1 text-xs font-bold text-[#33401a]">
                  Más ▾ <span className="rounded-full bg-[#33401a]/15 px-1.5 text-[0.65rem]">{more.length}</span>
                </span>
              </div>
              {open.has("__mas") && <ul className="ml-[0.7rem] mt-1 border-l-2 border-[var(--border)] pl-0">{more.map((b) => renderBranch(b, null))}</ul>}
            </li>
          )}
        </ul>
        <p className="mt-3 text-[0.7rem] leading-relaxed text-[var(--fg-muted)]">
          Es la barra real del sitio: las {NAV_VISIBLE} primeras secciones principales, en este orden, más «Buscar» y el menú «Más» con el resto. Las subsecciones no se ven en la barra: aparecen al entrar a su sección.
        </p>
      </div>

      <p className="text-[0.7rem] text-[var(--fg-muted)]">
        Arrastra una sección sobre otra para colgarla de ella, o sobre «Barra del sitio» para volverla principal (queda al final: en «Más» si ya hay {NAV_VISIBLE}). El menú tiene dos niveles: una sección con subsecciones no puede colgar de otra.
      </p>
      <NewSection padreId={null} label="Nueva sección principal" run={run} busy={busy} />
      {msg && <Msg r={msg} />}

      {sel && (
        <Detail sel={sel} sections={sections} tree={tree} onSelect={setSelected} onSaved={onSaved} run={run} busy={busy} />
      )}

      {wide &&
        createPortal(
          <WideTree
            tree={tree}
            sections={sections}
            selected={selected}
            onSelect={setSelected}
            onClose={() => setWide(false)}
            onSaved={onSaved}
            run={run}
            busy={busy}
            msg={msg}
          />,
          document.body,
        )}
    </div>
  );
}

function Msg({ r }: { r: EstructuraResult }) {
  return (
    <p role="status" className={`rounded-[var(--radius)] px-3 py-2 text-xs font-medium ${r.ok ? "bg-[#dbe5b7] text-[#2c3a10]" : "bg-[#f6d9d4] text-[#7a2518]"}`}>
      {r.message}
    </p>
  );
}

function NewSection({ padreId, label, run, busy }: { padreId: string | null; label: string; run: (p: () => Promise<EstructuraResult>) => void; busy: boolean }) {
  const [name, setName] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        run(() => crearSeccion(name, padreId));
        setName("");
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={label}
        maxLength={80}
        className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-white px-3.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
      />
      <button type="submit" disabled={busy || !name.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-fg)] disabled:opacity-50">
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Agregar
      </button>
    </form>
  );
}

/** Todo lo de una sección elegida: dependencia, orden, subsecciones, borrado y sus datos. */
function Detail({
  sel,
  sections,
  tree,
  onSelect,
  onSaved,
  run,
  busy,
}: {
  sel: SectionNode;
  sections: SectionNode[];
  tree: Branch[];
  onSelect: (id: string | null) => void;
  onSaved: () => void;
  run: (p: () => Promise<EstructuraResult>) => void;
  busy: boolean;
}) {
  const parent = sel.parentId ? sections.find((s) => s.id === sel.parentId) : null;
  const kids = sections.filter((s) => s.parentId === sel.id);
  const tops = tree.map((b) => b.node).filter((n) => n.id !== sel.id);
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-white p-3">
      <div>
        <p className="lx-kicker text-[var(--accent)]">{sel.parentId ? "Subsección" : "Sección principal"}</p>
        <h3 className="text-base font-bold">{sel.name}</h3>
        <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
          Menú principal{parent ? ` › ${parent.name}` : ""} › {sel.name}
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">Depende de</span>
        <select
          value={sel.parentId ?? ""}
          disabled={busy || (kids.length > 0)}
          onChange={(e) => run(() => moverSeccion(sel.id, e.target.value || null))}
          className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-sm disabled:opacity-60"
        >
          <option value="">— Ninguna (sección principal del menú)</option>
          {tops.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {kids.length > 0 && <span className="mt-1 block text-[0.7rem] text-[var(--fg-muted)]">Tiene subsecciones, así que no puede colgar de otra.</span>}
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">Orden en su nivel</span>
        <button type="button" disabled={busy} onClick={() => run(() => ordenarSeccion(sel.id, "arriba"))} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold hover:border-[var(--accent)] disabled:opacity-50">
          <ArrowUp size={12} /> Subir
        </button>
        <button type="button" disabled={busy} onClick={() => run(() => ordenarSeccion(sel.id, "abajo"))} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold hover:border-[var(--accent)] disabled:opacity-50">
          <ArrowDown size={12} /> Bajar
        </button>
      </div>

      {!sel.parentId && (
        <div>
          <p className="mb-1 text-xs font-semibold">Subsecciones ({kids.length})</p>
          {kids.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {kids.map((c) => (
                <button key={c.id} type="button" onClick={() => onSelect(c.id)} className="rounded-full border border-[var(--border)] bg-[#f1f5df] px-2.5 py-1 text-xs font-medium hover:border-[var(--accent)]">
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <NewSection padreId={sel.id} label={`Nueva subsección de ${sel.name}`} run={run} busy={busy} />
        </div>
      )}
      {parent && (
        <button type="button" onClick={() => onSelect(parent.id)} className="self-start text-xs font-semibold text-[var(--accent)]">
          ← Ir a {parent.name}
        </button>
      )}

      <SeccionForm key={`${sel.id}:${sel.sortOrder}`} {...pick(sel)} defaultOpen onSaved={onSaved} />

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (!window.confirm(`¿Eliminar la sección «${sel.name}»? Solo se puede si no tiene notas ni subsecciones.`)) return;
          run(async () => {
            const r = await eliminarSeccion(sel.id);
            if (r.ok) onSelect(null);
            return r;
          });
        }}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-[#c8584a] px-3 py-1.5 text-xs font-semibold text-[#9a2f22] hover:bg-[#f6d9d4] disabled:opacity-50"
      >
        <Trash2 size={12} /> Eliminar sección
      </button>
    </div>
  );
}

const pick = (s: SectionNode) => ({
  id: s.id,
  slug: s.slug,
  name: s.name,
  description: s.description,
  sortOrder: s.sortOrder,
  articleCount: s.articleCount,
});

function NodePill({ s, level, active, onClick, extra }: { s: SectionNode; level: 1 | 2; active: boolean; onClick: () => void; extra?: string }) {
  const base =
    level === 1
      ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]"
      : s.articleCount > 0
        ? "bg-[#cfe08a] text-[#1c2610] border-[#9fb84a]"
        : "bg-[#f1f5df] text-[#1c2610] border-[var(--border)]";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-w-0 items-center gap-2 rounded-full border px-3 py-1 text-left text-xs font-semibold transition hover:brightness-95 ${base} ${active ? "ring-2 ring-[#c9a227] ring-offset-1" : ""}`}
    >
      <span className="truncate">{s.name}</span>
      <span className="shrink-0 rounded-full bg-black/15 px-1.5 text-[0.62rem] font-bold">{s.articleCount}</span>
      {extra && <span className="shrink-0 text-[0.62rem] opacity-80">{extra}</span>}
    </button>
  );
}

// --- Árbol grande, de izquierda a derecha (estilo árbol de decisión) ---------

function WideTree({
  tree,
  sections,
  selected,
  onSelect,
  onClose,
  onSaved,
  run,
  busy,
  msg,
}: {
  tree: Branch[];
  sections: SectionNode[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  onSaved: () => void;
  run: (p: () => Promise<EstructuraResult>) => void;
  busy: boolean;
  msg: EstructuraResult | null;
}) {
  const ROW = 38, NODE_H = 30, PAD = 28;
  const CW = 172, GAP = 66;

  // Calco de la barra: 8 secciones, «Buscar» (fijo) y «Más» con el resto.
  type TNode = { key: string; label: string; kind: "root" | "item" | "extra" | "fixed" | "more" | "sub"; section?: SectionNode; kids: TNode[] };
  const asNode = (br: Branch, kind: "item" | "extra", pos: number | null): TNode => ({
    key: br.node.id,
    label: pos ? `${pos} · ${br.node.name}` : br.node.name,
    kind,
    section: br.node,
    kids: br.kids.map((k) => ({ key: k.id, label: k.name, kind: "sub" as const, section: k, kids: [] })),
  });
  const bar = tree.slice(0, NAV_VISIBLE);
  const more = tree.slice(NAV_VISIBLE);
  const root: TNode = {
    key: "root",
    label: "Barra del sitio",
    kind: "root",
    kids: [
      ...bar.map((b, i) => asNode(b, "item", i + 1)),
      { key: "search", label: "Buscar · fijo", kind: "fixed", kids: [] },
      ...(more.length ? [{ key: "more", label: "Más ▾", kind: "more" as const, kids: more.map((b) => asNode(b, "extra", null)) }] : []),
    ],
  };

  // Cada hoja ocupa una fila; los padres se centran frente a sus hijos.
  type Placed = { t: TNode; x: number; y: number; depth: number };
  const placed: Placed[] = [];
  const links: { ax: number; ay: number; bx: number; by: number }[] = [];
  let row = 0;
  let maxDepth = 0;
  const place = (t: TNode, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    const x = PAD + depth * (CW + GAP);
    let y: number;
    if (!t.kids.length) y = PAD + row++ * ROW + NODE_H / 2;
    else {
      const ys = t.kids.map((k) => place(k, depth + 1));
      y = (ys[0] + ys[ys.length - 1]) / 2;
      ys.forEach((ky) => links.push({ ax: x + CW, ay: y, bx: x + CW + GAP, by: ky }));
    }
    placed.push({ t, x, y, depth });
    return y;
  };
  place(root, 0);
  const width = PAD * 2 + (maxDepth + 1) * CW + maxDepth * GAP;
  const height = PAD * 2 + Math.max(row, 1) * ROW;
  const sel = sections.find((s) => s.id === selected) ?? null;

  const linkPath = (l: { ax: number; ay: number; bx: number; by: number }) =>
    `<path d="M${l.ax},${l.ay} C${l.ax + GAP / 2},${l.ay} ${l.bx - GAP / 2},${l.by} ${l.bx},${l.by}" fill="none" stroke="#bccb8f" stroke-width="2"/>`;
  const trunc = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
  const look = (t: TNode) => {
    const notes = t.section?.articleCount ?? 0;
    switch (t.kind) {
      case "root":
        return { fill: "#33401a", stroke: "none", text: "#ffffff", num: "#ffffff" };
      case "item":
        return { fill: "#556b2f", stroke: "none", text: "#ffffff", num: "#e6efc4" };
      case "extra":
        return { fill: "#7d8f45", stroke: "none", text: "#ffffff", num: "#eef2d9" };
      case "more":
        return { fill: "#eef2d9", stroke: "#33401a", text: "#33401a", num: "#33401a" };
      case "fixed":
        return { fill: "#ffffff", stroke: "#a9b57a", text: "#5a6a38", num: "#5a6a38" };
      default:
        return { fill: notes > 0 ? "#cfe08a" : "#f1f5df", stroke: notes > 0 ? "#9fb84a" : "#bccb8f", text: "#1c2610", num: "#44522a" };
    }
  };

  return (
    <div data-theme="panel-amber" role="dialog" aria-modal="true" aria-label="Árbol de secciones" className="fixed inset-0 z-[300] flex flex-col bg-[#1c2610]/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[#33401a] px-5 py-3 text-white">
          <Network size={16} />
          <h2 className="text-sm font-bold">Árbol de secciones</h2>
          <span className="hidden text-xs text-white/70 sm:inline">Barra del sitio › sección › subsección. Pulsa una para ver y editar sus datos.</span>
          <button type="button" onClick={onClose} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1c2610]">
            <X size={13} /> Cerrar
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="min-h-0 flex-1 overflow-auto bg-white">
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Árbol de secciones del menú" fontFamily="Inter, Helvetica, Arial, sans-serif">
              <g dangerouslySetInnerHTML={{ __html: links.map(linkPath).join("") }} />
              {placed.map(({ t, x, y }) => {
                const c = look(t);
                const pick = t.section;
                const isSel = !!pick && selected === pick.id;
                return (
                  <g
                    key={t.key}
                    onClick={pick ? () => onSelect(pick.id) : undefined}
                    className={pick ? "cursor-pointer" : undefined}
                    role={pick ? "button" : undefined}
                    aria-label={t.label}
                  >
                    {pick && <title>{`${pick.name} · ${pick.articleCount} notas`}</title>}
                    <rect x={x} y={y - NODE_H / 2} width={CW} height={NODE_H} rx={NODE_H / 2} fill={c.fill} stroke={isSel ? "#c9a227" : c.stroke} strokeWidth={isSel ? 3 : 2} strokeDasharray={t.kind === "fixed" ? "4 3" : undefined} />
                    <text x={t.kind === "root" || t.kind === "more" || t.kind === "fixed" ? x + CW / 2 : x + 14} y={y + 4} textAnchor={t.kind === "root" || t.kind === "more" || t.kind === "fixed" ? "middle" : "start"} fontSize="12.5" fontWeight={t.kind === "sub" || t.kind === "fixed" ? 600 : 700} fill={c.text}>
                      {trunc(t.label, 19)}
                    </text>
                    {pick && (
                      <text x={x + CW - 12} y={y + 4} textAnchor="end" fontSize="11" fontWeight="700" fill={c.num}>
                        {pick.articleCount}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <p className="px-5 pb-4 text-xs text-[var(--fg-muted)]">Es la barra real del sitio: las {NAV_VISIBLE} primeras secciones principales (numeradas, en su orden), «Buscar» y el menú «Más» con el resto. Las subsecciones no se ven en la barra: aparecen al entrar a su sección. El número de cada caja son las notas de esa sección; verde fuerte = tiene notas.</p>
          </div>
          <aside className="max-h-[45%] overflow-y-auto border-t border-[var(--border)] p-4 lg:max-h-none lg:w-[24rem] lg:border-l lg:border-t-0">
            <div className="flex flex-col gap-3">
              {msg && <Msg r={msg} />}
              {sel ? (
                <Detail sel={sel} sections={sections} tree={tree} onSelect={onSelect} onSaved={onSaved} run={run} busy={busy} />
              ) : (
                <p className="text-sm text-[var(--fg-muted)]">Pulsa una sección del árbol para ver de cuál depende y para moverla, ordenarla, agregarle subsecciones, editarla o eliminarla.</p>
              )}
              <div className="border-t border-[var(--border)] pt-3">
                <NewSection padreId={null} label="Nueva sección principal" run={run} busy={busy} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
