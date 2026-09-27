"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { Check, Loader2, Rocket, X } from "lucide-react";
import { HomeCanvasSite, type CanvasItem, type CanvasLayout } from "@/components/panel/home-canvas";
import { saveHomeLayout, saveHomeSectionLayout, saveSitePopup } from "@/app/panel/(app)/portada/actions";
import type { AdsZoneRow } from "@/lib/ads";
import type { PopupConfig } from "@/lib/popup-types";
import { ACCEPTED_KEY, DRAFT_KEY, parseDraft } from "@/lib/portada-draft";
import type { FooterId, NavbarId } from "@/lib/template-parts";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
const readDraft = () => {
  try {
    return localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
};

/**
 * Vista previa de la portada a tamaño real, en su propia pestaña. Muestra el
 * diseño que se está editando en la otra pestaña (aunque no esté guardado) y se
 * actualiza sola. «Aceptar y publicar» guarda ese diseño en el sitio.
 */
export function HomePreviewTab({
  initialItems,
  initialLayout,
  initialPopup,
  headerVariants,
  footerVariants,
  adsZones,
}: {
  initialItems: CanvasItem[];
  initialLayout: CanvasLayout;
  initialPopup: PopupConfig;
  headerVariants: Record<NavbarId, React.ReactNode>;
  footerVariants: Record<FooterId, React.ReactNode>;
  adsZones: AdsZoneRow[];
}) {
  const raw = useSyncExternalStore(subscribe, readDraft, () => null);
  const draft = useMemo(() => parseDraft(raw), [raw]);

  const layout = draft?.layout ?? initialLayout;
  const popup = draft?.popup ?? initialPopup;
  const adDrafts = draft?.adDrafts ?? {};

  // Notas en el orden y con el estilo del borrador.
  const items = useMemo(() => {
    if (!draft) return initialItems;
    const byId = new Map(initialItems.map((i) => [i.id, i]));
    const ordered = draft.items
      .map((d) => {
        const base = byId.get(d.id);
        return base ? { ...base, homeStyle: d.homeStyle } : null;
      })
      .filter((i): i is CanvasItem => i !== null);
    // Notas nuevas publicadas después de abrir el editor: al final.
    const seen = new Set(ordered.map((i) => i.id));
    return [...ordered, ...initialItems.filter((i) => !seen.has(i.id))];
  }, [draft, initialItems]);

  const changed = useMemo(() => {
    const serial = (l: unknown, its: { id: string; homeStyle: unknown }[], p: unknown) =>
      JSON.stringify([l, its.map((i) => [i.id, i.homeStyle ?? null]), p]);
    return (
      serial(layout, items, popup) !== serial(initialLayout, initialItems, initialPopup)
    );
  }, [layout, items, popup, initialLayout, initialItems, initialPopup]);

  const [popupOpen, setPopupOpen] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function accept() {
    setMsg(null);
    start(async () => {
      try {
        await saveHomeLayout(items.map((i) => ({ id: i.id, homeStyle: i.homeStyle ?? null })));
        await saveHomeSectionLayout(layout);
        // El popup solo se guarda si se tocó: al guardarlo vuelve a mostrarse
        // también a quien ya lo había cerrado.
        if (JSON.stringify(popup) !== JSON.stringify(initialPopup)) await saveSitePopup(popup);
        try {
          localStorage.setItem(ACCEPTED_KEY, String(Date.now()));
        } catch {
          /* sin almacenamiento: el editor se recargará a mano */
        }
        setConfirming(false);
        setMsg({ ok: true, text: "Publicado en el sitio ✓" });
      } catch {
        setConfirming(false);
        setMsg({ ok: false, text: "No se pudo publicar. Revisa que tu sesión siga activa." });
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[200] bg-white">
      {/* Barra de decisión: siempre a la vista, por encima de la portada. */}
      <div
        data-theme="panel-ui"
        className="absolute inset-x-0 top-0 z-[120] flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)] px-4 text-[var(--fg)] shadow-md"
      >
        <span className="rounded-full bg-[#b45309] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white">
          Vista previa
        </span>
        <p className="hidden min-w-0 flex-1 truncate text-xs text-[var(--fg-muted)] sm:block">
          {draft
            ? "Se actualiza sola mientras editas en la otra pestaña. Nada está publicado todavía."
            : "Sin cambios en el editor: esto es lo que está publicado."}
        </p>
        <span className="flex-1 sm:hidden" />

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
      <div
        className="absolute inset-x-0 bottom-0 top-14 overflow-y-auto"
        onClickCapture={(e) => {
          // Los enlaces de la vista previa no navegan.
          if ((e.target as HTMLElement).closest("a")) e.preventDefault();
        }}
      >
        <HomeCanvasSite
          layout={layout}
          items={items}
          headerVariants={headerVariants}
          footerVariants={footerVariants}
          adsZones={adsZones}
          adDrafts={adDrafts}
          popup={popup}
          popupPreview={popup.enabled && popupOpen}
          onPopupClose={() => setPopupOpen(false)}
        />
      </div>
    </div>
  );
}
