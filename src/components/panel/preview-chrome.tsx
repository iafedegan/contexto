"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, GripHorizontal, Loader2, Paintbrush, Rocket, X } from "lucide-react";
import { publishHomeDraft, saveHomeDraft } from "@/app/panel/(app)/portada/actions";
import { ACCEPTED_KEY, ADS_EDIT_KEY, DRAFT_PING_KEY, ITEMS_EDIT_KEY, LAYOUT_EDIT_KEY, SECCIONES_KEY, type PortadaDraft } from "@/lib/portada-draft";
import { RegionEditor } from "@/components/panel/region-editor";
import { SeccionForm } from "@/components/panel/seccion-form";
import { TemplatePicker } from "@/components/panel/home-builder";
import type { RegionId } from "@/lib/home-regions";
import type { HomeStyle, SectionElId } from "@/db/schema";
import { BlockStyleEditor } from "@/components/panel/block-style-editor";
import { cleanupBlocks, enhanceBlocks, measureZone, type ZoneMapData } from "@/lib/block-tools";
import type { ZoneStyle } from "@/db/schema";
import type { ZoneBundle } from "@/components/panel/block-style-editor";
import { SectionPanel } from "@/components/panel/section-panel";
import { AdsPanel } from "@/components/panel/ads-panel";
import type { AdDraft, AdsZoneRow } from "@/components/panel/ads-zone-form";

/**
 * Marco de la pestaña «Vista previa»: barra con Cerrar y «Aceptar y publicar»
 * y, debajo, la portada real (que llega como `children`, renderizada en el
 * servidor con el borrador aplicado). Se refresca sola cuando el editor cambia
 * algo en la otra pestaña.
 */
export function PreviewChrome({
  changed,
  hasDraft,
  draft,
  seccion = null,
  adsZones = [],
  canManagePauta = false,
  children,
}: {
  changed: boolean;
  hasDraft: boolean;
  /** Borrador del editor: con él se habilita el formulario flotante. */
  draft?: PortadaDraft | null;
  /** Sección que se está viendo (null = la portada). */
  seccion?: { id: string; slug: string; name: string; description: string | null; sortOrder: number; articleCount: number } | null;
  /** Zonas de publicidad (para la pestaña Publicidad del formulario flotante). */
  adsZones?: AdsZoneRow[];
  canManagePauta?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [layout, setLayout] = useState(draft?.layout ?? null);
  const [panel, setPanel] = useState(false);
  const [region, setRegion] = useState<RegionId>("navbar");
  const [secEl, setSecEl] = useState<SectionElId>("title");
  const [items, setItems] = useState<PortadaDraft["items"]>(draft?.items ?? []);
  const [adDrafts, setAdDrafts] = useState<Record<string, AdDraft>>(draft?.adDrafts ?? {});
  const adDraftsRef = useRef(adDrafts);
  const [selSlug, setSelSlug] = useState<string | null>(null);
  const [selTitle, setSelTitle] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoneMap, setZoneMap] = useState<ZoneMapData | null>(null);
  // Posición del formulario flotante: arrastrable y recordada entre visitas.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const v = JSON.parse(localStorage.getItem("cg:editor-flotante") ?? "null");
      if (v && typeof v.x === "number" && typeof v.y === "number") {
        return { x: Math.min(v.x, window.innerWidth - 80), y: Math.min(v.y, window.innerHeight - 60) };
      }
    } catch {
      /* sin almacenamiento */
    }
    return null;
  });
  const boxRef = useRef<HTMLDivElement>(null);
  function startDrag(e: React.PointerEvent) {
    const box = boxRef.current;
    if (!box) return;
    e.preventDefault();
    const r = box.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    let last = { x: r.left, y: r.top };
    const move = (ev: PointerEvent) => {
      last = {
        x: Math.max(0, Math.min(window.innerWidth - 120, ev.clientX - dx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - dy)),
      };
      setPos(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try {
        localStorage.setItem("cg:editor-flotante", JSON.stringify(last));
      } catch {
        /* sin almacenamiento */
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const draftRef = useRef(draft);
  const layoutRef = useRef(layout);
  const itemsRef = useRef(items);
  useEffect(() => {
    draftRef.current = draft;
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cada ajuste se guarda en el borrador (y se avisa al editor) y la vista se refresca.
  function persist() {
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      timer.current = null;
      const base = draftRef.current;
      if (!base) return setSaveState("error");
      try {
        const res = await saveHomeDraft({ ...base, layout: layoutRef.current ?? base.layout, items: itemsRef.current, adDrafts: adDraftsRef.current });
        if (!res.ok) return setSaveState("error");
        localStorage.setItem(LAYOUT_EDIT_KEY, JSON.stringify(layoutRef.current));
        localStorage.setItem(ITEMS_EDIT_KEY, JSON.stringify(itemsRef.current));
        localStorage.setItem(ADS_EDIT_KEY, JSON.stringify(adDraftsRef.current));
        setSaveState("saved");
        router.refresh();
      } catch {
        setSaveState("error");
      }
    }, 600);
  }
  function editLayout(next: NonNullable<typeof layout>) {
    layoutRef.current = next;
    setLayout(next);
    persist();
  }
  function editAd(key: string, d: AdDraft) {
    adDraftsRef.current = { ...adDraftsRef.current, [key]: d };
    setAdDrafts(adDraftsRef.current);
    persist();
  }
  /** Cambia el estilo de un bloque (nota); `null` lo restablece. */
  function patchBlock(slug: string, partial: Partial<HomeStyle> | null) {
    const cur = itemsRef.current;
    const apply = (st: HomeStyle | null): HomeStyle | null => {
      if (partial === null) return null;
      const merged = { ...(st ?? {}), ...partial } as Record<string, unknown>;
      for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
      return Object.keys(merged).length ? (merged as HomeStyle) : null;
    };
    const next = cur.some((i) => i.slug === slug)
      ? cur.map((i) => (i.slug === slug ? { ...i, homeStyle: apply(i.homeStyle) } : i))
      : [...cur, { slug, homeStyle: apply(null) }];
    itemsRef.current = next;
    setItems(next);
    persist();
  }
  /** Cambia de sitio un bloque de la portada (índices de posición). */
  function moveBlock(from: number, to: number) {
    const next = itemsRef.current.slice();
    if (from < 0 || from >= next.length || to < 0 || to >= next.length) return;
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    itemsRef.current = next;
    setItems(next);
    persist();
  }

  // Si el editor cambia el diseño en la otra pestaña, el formulario lo refleja.
  useEffect(() => {
    if (!timer.current && draft) {
      layoutRef.current = draft.layout;
      itemsRef.current = draft.items;
      adDraftsRef.current = draft.adDrafts;
      setLayout(draft.layout);
      setItems(draft.items);
      setAdDrafts(draft.adDrafts);
    }
  }, [draft]);

  // Mapa de la zona del bloque elegido (se mide tras cada refresco).
  useEffect(() => {
    const id = setTimeout(() => {
      const root = contentRef.current;
      if (!root || !selSlug || !/^[\w-]+$/.test(selSlug)) return setZoneMap(null);
      const el = root.querySelector<HTMLElement>(`[data-bslug="${selSlug}"]`) ?? root.querySelector<HTMLElement>(`[data-bs-root="${selSlug}"]`);
      setZoneMap(el ? measureZone(el) : null);
    }, 900);
    return () => clearTimeout(id);
  }, [selSlug, children]);

  function setZone(key: string, z: ZoneStyle | undefined) {
    if (!layout) return;
    const zones = { ...(layout.zones ?? {}) };
    if (z && Object.keys(z).length) zones[key] = z;
    else delete zones[key];
    editLayout({ ...layout, zones });
  }
  const zoneBundle = (): ZoneBundle => ({
    map: zoneMap,
    style: zoneMap?.key ? layout?.zones?.[zoneMap.key] : undefined,
    selectedSlug: selSlug,
    // setZone solo se ejecuta en un manejador de eventos (usa refs), no al renderizar.
    // eslint-disable-next-line react-hooks/refs
    onChange: (z) => zoneMap?.key && setZone(zoneMap.key, z),
    onSelect: (it) => {
      if (!it.slug) return;
      setSelSlug(it.slug);
      setSelTitle(it.label || it.slug);
    },
  });

  // Asas de tamaño y arrastre sobre los bloques reales de la página.
  useEffect(() => {
    const root = contentRef.current;
    if (!root || !panel) return;
    const id = setTimeout(() => {
      enhanceBlocks(document, root, {
        onResize: (slug, patch) => {
          patchBlock(slug, patch);
          setSelSlug(slug);
        },
        onMove: (from, to) => moveBlock(from, to),
      });
    }, 400);
    return () => {
      clearTimeout(id);
      cleanupBlocks(root);
    };
    // patchBlock y moveBlock solo usan refs: no hace falta reinstalar por ellas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, panel]);


  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DRAFT_PING_KEY) router.refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [router]);

  function accept() {
    setMsg(null);
    start(async () => {
      try {
        const res = await publishHomeDraft();
        setConfirming(false);
        setMsg({ ok: res.ok, text: res.ok ? "Publicado en el sitio ✓" : res.message });
        if (res.ok) {
          try {
            localStorage.setItem(ACCEPTED_KEY, String(Date.now()));
          } catch {
            /* el editor se recargará a mano */
          }
          router.refresh();
        }
      } catch {
        setConfirming(false);
        setMsg({ ok: false, text: "No se pudo publicar. Revisa que tu sesión siga activa." });
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[200] bg-white">
      <div
        data-theme="panel-ui"
        className="absolute inset-x-0 top-0 z-[120] flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)] px-4 text-[var(--fg)] shadow-md"
      >
        <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white">
          Vista previa
        </span>
        <p className="hidden min-w-0 flex-1 truncate text-xs text-[var(--fg-muted)] md:block">
          {changed
            ? "Esta es la portada real con tus cambios sin publicar: así se verá en el sitio. Se actualiza sola al editar."
            : hasDraft
              ? "Sin cambios pendientes: esto es exactamente lo que está publicado."
              : "Abre el editor y cambia algo para verlo aquí antes de publicar."}
        </p>
        <span className="flex-1 md:hidden" />

        {msg && (
          <span className={`flex items-center gap-1.5 text-xs font-semibold ${msg.ok ? "text-[#15803d]" : "text-[var(--danger,#b4442e)]"}`}>
            {msg.ok && <Check size={14} />} {msg.text}
          </span>
        )}

        {confirming ? (
          <>
            <span className="text-xs font-semibold">¿Publicar este diseño en el sitio?</span>
            <button
              type="button"
              onClick={accept}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-fg)] disabled:opacity-60"
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />} Sí, publicar
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-full border border-[var(--border-strong)] px-3.5 py-2 text-xs font-semibold"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => window.close()}
              title="Cierra esta pestaña sin publicar"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3.5 py-2 text-xs font-semibold transition hover:border-[var(--accent)]"
            >
              <X size={13} /> Cerrar
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!changed}
              title={changed ? "Publica este diseño en el sitio" : "No hay cambios sin publicar"}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-fg)] transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check size={14} /> Aceptar y publicar
            </button>
          </>
        )}
      </div>

      {/* Scroll propio: la cabecera pegajosa de la portada queda bajo la barra. */}
      {selSlug && /^[\w-]+$/.test(selSlug) && (
        <style>{`[data-bslug="${selSlug}"],[data-bs-root="${selSlug}"]:not([data-bslug] *){outline:3px solid #84a21f!important;outline-offset:2px}`}</style>
      )}
      <div
        ref={contentRef}
        className="absolute inset-x-0 bottom-0 top-14 overflow-y-auto"
        onClickCapture={(e) => {
          // Los enlaces de la vista previa no navegan: llevarían a la página publicada.
          const el = e.target as HTMLElement;
          const link = el.closest("a");
          if (link) {
            e.preventDefault();
            const url = new URL(link.href, "https://x.invalid");
            const sec = url.pathname.match(/^\/(?:en\/)?categoria\/([^/]+)\/?$/);
            if (sec && !el.closest("[data-bslug],[data-bs-root]")) {
              router.push(`/panel/portada?vista=1&seccion=${sec[1]}`);
              return;
            }
            if ((url.pathname === "/" || url.pathname === "/en") && !el.closest("[data-bslug],[data-bs-root]")) {
              router.push("/panel/portada?vista=1");
              return;
            }
          }
          const piece = el.closest("[data-el]")?.getAttribute("data-el") as SectionElId | null;
          if (piece && panel) {
            setSecEl(piece);
            setRegion("encabezado");
            return;
          }
          const blockEl = el.closest<HTMLElement>("[data-bslug],[data-bs-root]");
          const slug = blockEl?.getAttribute("data-bslug") ?? blockEl?.getAttribute("data-bs-root");
          if (slug && panel) {
            setSelSlug(slug);
            setSelTitle(blockEl?.querySelector("h1,h2,h3")?.textContent?.trim() ?? slug);
            setRegion("body");
            return;
          }
          const r = el.closest("[data-region]")?.getAttribute("data-region") as RegionId | null;
          if (r && panel && (!seccion || r === "encabezado" || r === "body")) setRegion(r);
        }}
      >
        {children}
      </div>

      {layout && (
        <div
          ref={boxRef}
          suppressHydrationWarning
          data-theme="panel-ui"
          style={pos ? { left: pos.x, top: pos.y, maxHeight: `calc(100dvh - ${pos.y}px - 1rem)` } : undefined}
          className={`fixed z-[130] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col items-end gap-2 text-[var(--fg)] ${pos ? "" : "bottom-4 right-4 max-h-[calc(100dvh-6rem)]"}`}
        >
          {panel && (
            <div className="w-full overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-4 shadow-2xl">
              <div
                onPointerDown={startDrag}
                title="Arrastra para mover el panel"
                className="-mx-4 -mt-4 mb-3 flex cursor-grab touch-none select-none items-center gap-2 rounded-t-[var(--radius-lg)] bg-[var(--surface-2)] px-4 py-2 active:cursor-grabbing"
              >
                <GripHorizontal size={14} className="text-[var(--fg-muted)]" />
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
                {seccion ? `Editar sección · ${seccion.name}` : "Editar esta vista"}
              </p>
              </div>
              {seccion && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => router.push("/panel/portada?vista=1")}
                    className="mb-3 text-xs font-semibold text-[var(--accent)]"
                  >
                    ← Volver al inicio
                  </button>
                  <SeccionForm
                    key={`${seccion.id}:${seccion.sortOrder}`}
                    {...seccion}
                    onSaved={() => {
                      try {
                        localStorage.setItem(SECCIONES_KEY, String(Date.now()));
                      } catch {
                        /* sin almacenamiento */
                      }
                      router.refresh();
                    }}
                  />
                </div>
              )}
              {!seccion && (
              <details className="mb-4 rounded-[var(--radius)] border border-[var(--border)]">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Plantilla</summary>
                <div className="border-t border-[var(--border)] p-3">
                  <TemplatePicker layout={layout} onPick={(config) => editLayout({ ...config, parts: {}, sectionFilters: layout.sectionFilters })} compacto />
                </div>
              </details>
              )}
              {seccion ? (
                <SectionPanel
                  layout={layout}
                  onChange={(partial) => editLayout({ ...layout, ...partial })}
                  region={region}
                  onRegion={setRegion}
                  el={secEl}
                  onEl={setSecEl}
                  ads={{ zones: adsZones, canManage: canManagePauta, drafts: adDrafts, onDraft: editAd }}
                  block={
                    selSlug
                      ? {
                          title: selTitle,
                          style: items.find((i) => i.slug === selSlug)?.homeStyle ?? {},
                          onChange: (p) => patchBlock(selSlug, p),
                          onClear: () => patchBlock(selSlug, null),
                          zone: zoneBundle(),
                        }
                      : null
                  }
                />
              ) : (
                <RegionEditor
                  value={layout.regions ?? {}}
                  active={region}
                  onActive={setRegion}
                  onChange={(regions) => editLayout({ ...layout, regions })}
                  only={["navbar", "hero", "cards", "body", "footer"]}
                />
              )}
              {!seccion && selSlug && (
                <div className="mt-4">
                  <BlockStyleEditor
                    title={selTitle}
                    style={items.find((i) => i.slug === selSlug)?.homeStyle ?? {}}
                    onChange={(p) => patchBlock(selSlug, p)}
                    onClear={() => patchBlock(selSlug, null)}
                    zone={zoneBundle()}
                  />
                </div>
              )}
              {!seccion && (
                <details className="mt-4 rounded-[var(--radius)] border border-[var(--border)]">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Publicidad</summary>
                  <div className="border-t border-[var(--border)] p-3">
                    <AdsPanel layout={layout} zones={adsZones} canManage={canManagePauta} drafts={adDrafts} onDraft={editAd} />
                  </div>
                </details>
              )}
              <p role="status" className={`mt-3 text-xs font-semibold ${saveState === "error" ? "text-[#9a2f22]" : "text-[var(--accent)]"}`}>
                {saveState === "saving" && "Guardando cambios…"}
                {saveState === "saved" && "Cambios guardados en el borrador ✓ (se ven en la página)"}
                {saveState === "error" && "No se pudo guardar el cambio. Recarga la vista previa desde el editor y vuelve a intentarlo."}
              </p>
              <p className="mt-3 text-xs text-[var(--fg-muted)]">Pulsa un componente de la página para elegirlo. Los cambios quedan en el borrador; se publican con «Aceptar y publicar».</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setPanel((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-[var(--accent-fg)] shadow-lg"
          >
            <Paintbrush size={14} /> {panel ? "Cerrar editor" : "Editar"}
          </button>
        </div>
      )}
    </div>
  );
}
