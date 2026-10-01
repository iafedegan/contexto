"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Maximize2, Network, X } from "lucide-react";
import { SeccionForm } from "@/components/panel/seccion-form";

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

function buildTree(sections: SectionNode[]): Branch[] {
  const byOrder = (a: SectionNode, b: SectionNode) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es");
  const ids = new Set(sections.map((s) => s.id));
  const roots = sections.filter((s) => !s.parentId || !ids.has(s.parentId)).sort(byOrder);
  return roots.map((r) => ({ node: r, kids: sections.filter((s) => s.parentId === r.id).sort(byOrder) }));
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
  const sel = sections.find((s) => s.id === selected) ?? null;

  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(new Set(tree.filter((b) => b.kids.length).map((b) => b.node.id)))} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold hover:border-[var(--accent)]">
          Expandir todo
        </button>
        <button type="button" onClick={() => setOpen(new Set())} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold hover:border-[var(--accent)]">
          Contraer
        </button>
        <button type="button" onClick={() => setWide(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent-fg)]">
          <Maximize2 size={12} /> Ver árbol completo
        </button>
      </div>

      {/* Árbol compacto */}
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#33401a] px-3 py-1.5 text-xs font-bold text-white">
          <Network size={13} /> Menú principal
          <span className="rounded-full bg-white/20 px-1.5 text-[0.65rem]">{tree.length}</span>
        </div>
        <ul className="ml-4 border-l-2 border-[var(--border-strong)]/50 pl-0">
          {tree.map(({ node, kids }) => {
            const isOpen = open.has(node.id);
            return (
              <li key={node.id} className="relative pl-5 pt-1.5">
                <span aria-hidden className="absolute left-0 top-[1.15rem] h-0.5 w-5 bg-[var(--border-strong)]/50" />
                <div className="flex items-center gap-1">
                  {kids.length > 0 ? (
                    <button type="button" onClick={() => toggle(node.id)} aria-label={isOpen ? "Contraer" : "Expandir"} className="grid size-6 place-items-center rounded-full hover:bg-[var(--surface-2)]">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  ) : (
                    <span className="size-6" />
                  )}
                  <NodePill s={node} level={1} active={selected === node.id} onClick={() => setSelected(node.id)} extra={kids.length ? `${kids.length} sub` : undefined} />
                </div>
                {isOpen && kids.length > 0 && (
                  <ul className="ml-[0.7rem] mt-1 border-l-2 border-[var(--border)] pl-0">
                    {kids.map((k) => (
                      <li key={k.id} className="relative pl-5 pt-1">
                        <span aria-hidden className="absolute left-0 top-[0.95rem] h-0.5 w-5 bg-[var(--border)]" />
                        <NodePill s={k} level={2} active={selected === k.id} onClick={() => setSelected(k.id)} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {sel && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[var(--fg-muted)]">
            {sel.parentId ? (
              <>
                Depende de <strong>{sections.find((s) => s.id === sel.parentId)?.name}</strong> (menú principal › … › {sel.name}).
              </>
            ) : (
              <>
                Sección principal del menú{tree.find((b) => b.node.id === sel.id)?.kids.length ? `, de la que cuelgan ${tree.find((b) => b.node.id === sel.id)!.kids.length} subsecciones` : ""}.
              </>
            )}
          </p>
          <SeccionForm key={sel.id} {...pick(sel)} defaultOpen onSaved={onSaved} />
        </div>
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
          />,
          document.body,
        )}
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
}: {
  tree: Branch[];
  sections: SectionNode[];
  selected: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ROW = 38, NODE_H = 30, PAD = 28;
  const W0 = 150, W1 = 190, W2 = 190, GAP = 80;
  const x0 = PAD, x1 = x0 + W0 + GAP, x2 = x1 + W1 + GAP;
  const width = x2 + W2 + PAD;

  // Cada subsección ocupa una fila; la sección se centra frente a sus hijos.
  let row = 0;
  const placed = tree.map(({ node, kids }) => {
    const first = row;
    const kidRows = kids.length ? kids.map(() => row++) : [row++];
    const y = PAD + ((first + kidRows[kidRows.length - 1]) / 2) * ROW + NODE_H / 2;
    return { node, y, kids: kids.map((k, i) => ({ k, y: PAD + kidRows[i] * ROW + NODE_H / 2 })) };
  });
  const height = PAD * 2 + Math.max(row, 1) * ROW;
  const rootY = placed.length ? (placed[0].y + placed[placed.length - 1].y) / 2 : PAD;
  const sel = sections.find((s) => s.id === selected) ?? null;
  const parent = sel?.parentId ? sections.find((s) => s.id === sel.parentId) : null;
  const children = sel ? sections.filter((s) => s.parentId === sel.id) : [];

  const link = (ax: number, ay: number, bx: number, by: number, color: string) =>
    `<path d="M${ax},${ay} C${ax + GAP / 2},${ay} ${bx - GAP / 2},${by} ${bx},${by}" fill="none" stroke="${color}" stroke-width="2"/>`;
  const trunc = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

  return (
    <div data-theme="panel-amber" role="dialog" aria-modal="true" aria-label="Árbol de secciones" className="fixed inset-0 z-[300] flex flex-col bg-[#1c2610]/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[#33401a] px-5 py-3 text-white">
          <Network size={16} />
          <h2 className="text-sm font-bold">Árbol de secciones</h2>
          <span className="hidden text-xs text-white/70 sm:inline">Menú principal › sección › subsección. Pulsa una para ver y editar sus datos.</span>
          <button type="button" onClick={onClose} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1c2610]">
            <X size={13} /> Cerrar
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="min-h-0 flex-1 overflow-auto bg-white">
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Árbol de secciones del menú" fontFamily="Inter, Helvetica, Arial, sans-serif">
              <g dangerouslySetInnerHTML={{ __html: placed.map((p) => link(x0 + W0, rootY, x1, p.y, "#bccb8f")).join("") + placed.flatMap((p) => p.kids.map((c) => link(x1 + W1, p.y, x2, c.y, "#d3dcb0"))).join("") }} />
              <g>
                <rect x={x0} y={rootY - NODE_H / 2} width={W0} height={NODE_H} rx={NODE_H / 2} fill="#33401a" />
                <text x={x0 + W0 / 2} y={rootY + 4} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#fff">Menú principal</text>
              </g>
              {placed.map(({ node, y, kids }) => (
                <g key={node.id}>
                  <g onClick={() => onSelect(node.id)} className="cursor-pointer" role="button" aria-label={node.name}>
                    <title>{`${node.name} · ${node.articleCount} notas`}</title>
                    <rect x={x1} y={y - NODE_H / 2} width={W1} height={NODE_H} rx={NODE_H / 2} fill="#556b2f" stroke={selected === node.id ? "#c9a227" : "none"} strokeWidth={3} />
                    <text x={x1 + 14} y={y + 4} fontSize="12.5" fontWeight="700" fill="#fff">{trunc(node.name, 20)}</text>
                    <text x={x1 + W1 - 12} y={y + 4} textAnchor="end" fontSize="11" fontWeight="700" fill="#e6efc4">{node.articleCount}</text>
                  </g>
                  {kids.map(({ k, y: ky }) => (
                    <g key={k.id} onClick={() => onSelect(k.id)} className="cursor-pointer" role="button" aria-label={k.name}>
                      <title>{`${k.name} · ${k.articleCount} notas`}</title>
                      <rect x={x2} y={ky - NODE_H / 2} width={W2} height={NODE_H} rx={NODE_H / 2} fill={k.articleCount > 0 ? "#cfe08a" : "#f1f5df"} stroke={selected === k.id ? "#c9a227" : k.articleCount > 0 ? "#9fb84a" : "#bccb8f"} strokeWidth={selected === k.id ? 3 : 1.5} />
                      <text x={x2 + 14} y={ky + 4} fontSize="12.5" fontWeight="600" fill="#1c2610">{trunc(k.name, 20)}</text>
                      <text x={x2 + W2 - 12} y={ky + 4} textAnchor="end" fontSize="11" fontWeight="700" fill="#44522a">{k.articleCount}</text>
                    </g>
                  ))}
                </g>
              ))}
            </svg>
            <p className="px-5 pb-4 text-xs text-[var(--fg-muted)]">El número de cada caja son las notas publicadas o en preparación de esa sección. Verde fuerte: la sección tiene notas.</p>
          </div>
          <aside className="max-h-[45%] overflow-y-auto border-t border-[var(--border)] p-4 lg:max-h-none lg:w-[24rem] lg:border-l lg:border-t-0">
            {sel ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="lx-kicker text-[var(--accent)]">{sel.parentId ? "Subsección" : "Sección principal"}</p>
                  <h3 className="text-lg font-bold">{sel.name}</h3>
                  <p className="mt-1 text-xs text-[var(--fg-muted)]">
                    Menú principal{parent ? ` › ${parent.name}` : ""} › {sel.name}
                  </p>
                </div>
                {children.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold">Subsecciones ({children.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {children.map((c) => (
                        <button key={c.id} type="button" onClick={() => onSelect(c.id)} className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-medium hover:border-[var(--accent)]">
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {parent && (
                  <button type="button" onClick={() => onSelect(parent.id)} className="self-start text-xs font-semibold text-[var(--accent)]">
                    ← Ir a {parent.name}
                  </button>
                )}
                <SeccionForm key={sel.id} {...pick(sel)} defaultOpen onSaved={onSaved} />
              </div>
            ) : (
              <p className="text-sm text-[var(--fg-muted)]">Pulsa una sección del árbol para ver de cuál depende, cuáles cuelgan de ella y editar su nombre, descripción y orden.</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
