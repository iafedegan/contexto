"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, GripHorizontal, Loader2, Paintbrush, Rocket, X } from "lucide-react";
import { publishHomeDraft, saveHomeDraft } from "@/app/panel/(app)/portada/actions";
import { ACCEPTED_KEY, DRAFT_PING_KEY, LAYOUT_EDIT_KEY, type PortadaDraft } from "@/lib/portada-draft";
import { RegionEditor } from "@/components/panel/region-editor";
import { SeccionForm } from "@/components/panel/seccion-form";
import { TemplatePicker } from "@/components/panel/home-builder";
import type { RegionId } from "@/lib/home-regions";

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
  children,
}: {
  changed: boolean;
  hasDraft: boolean;
  /** Borrador del editor: con él se habilita el formulario flotante. */
  draft?: PortadaDraft | null;
  /** Sección que se está viendo (null = la portada). */
  seccion?: { id: string; slug: string; name: string; description: string | null; sortOrder: number; articleCount: number } | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [layout, setLayout] = useState(draft?.layout ?? null);
  const [panel, setPanel] = useState(false);
  const [region, setRegion] = useState<RegionId>("navbar");
  // Posición del formulario flotante: arrastrable y recordada entre visitas.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem("cg:editor-flotante") ?? "null");
      if (v && typeof v.x === "number" && typeof v.y === "number") {
        setPos({ x: Math.min(v.x, window.innerWidth - 80), y: Math.min(v.y, window.innerHeight - 60) });
      }
    } catch {
      /* sin almacenamiento */
    }
  }, []);
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
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cada ajuste se guarda en el borrador (y se avisa al editor) y la vista se refresca.
  function editLayout(next: NonNullable<typeof layout>) {
    setLayout(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      timer.current = null;
      const base = draftRef.current;
      if (!base) return;
      try {
        await saveHomeDraft({ ...base, layout: next });
        localStorage.setItem(LAYOUT_EDIT_KEY, JSON.stringify(next));
        router.refresh();
      } catch {
        /* sin permiso o sin conexión */
      }
    }, 600);
  }

  // Si el editor cambia el diseño en la otra pestaña, el formulario lo refleja.
  useEffect(() => {
    if (!timer.current && draft) setLayout(draft.layout);
  }, [draft]);

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
        <span className="rounded-full bg-[#b45309] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white">
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
      <div
        className="absolute inset-x-0 bottom-0 top-14 overflow-y-auto"
        onClickCapture={(e) => {
          // Los enlaces de la vista previa no navegan: llevarían a la página publicada.
          const el = e.target as HTMLElement;
          const link = el.closest("a");
          if (link) {
            e.preventDefault();
            const url = new URL(link.href, "https://x.invalid");
            const sec = url.pathname.match(/^\/(?:en\/)?categoria\/([^/]+)\/?$/);
            if (sec) router.push(`/panel/portada?vista=1&seccion=${sec[1]}`);
            else if (url.pathname === "/" || url.pathname === "/en") router.push("/panel/portada?vista=1");
            return;
          }
          const r = el.closest("[data-region]")?.getAttribute("data-region") as RegionId | null;
          if (r && panel) setRegion(r);
        }}
      >
        {children}
      </div>

      {layout && (
        <div
          ref={boxRef}
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
                  <SeccionForm key={seccion.id} {...seccion} defaultOpen onSaved={() => router.refresh()} />
                </div>
              )}
              {!seccion && (
              <details className="mb-4 rounded-[var(--radius)] border border-[var(--border)]">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Plantilla</summary>
                <div className="border-t border-[var(--border)] p-3">
                  <TemplatePicker layout={layout} onPick={(config) => editLayout({ ...config, parts: {} })} compacto />
                </div>
              </details>
              )}
              <RegionEditor
                value={layout.regions ?? {}}
                active={seccion && region !== "navbar" && region !== "body" && region !== "footer" ? "body" : region}
                onActive={setRegion}
                onChange={(regions) => editLayout({ ...layout, regions })}
                only={seccion ? ["navbar", "body", "footer"] : undefined}
              />
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
