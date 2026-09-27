"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Rocket, X } from "lucide-react";
import { publishHomeDraft } from "@/app/panel/(app)/portada/actions";
import { ACCEPTED_KEY, DRAFT_PING_KEY } from "@/lib/portada-draft";

/**
 * Marco de la pestaña «Vista previa»: barra con Cerrar y «Aceptar y publicar»
 * y, debajo, la portada real (que llega como `children`, renderizada en el
 * servidor con el borrador aplicado). Se refresca sola cuando el editor cambia
 * algo en la otra pestaña.
 */
export function PreviewChrome({
  changed,
  hasDraft,
  children,
}: {
  changed: boolean;
  hasDraft: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
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
          if ((e.target as HTMLElement).closest("a")) e.preventDefault();
        }}
      >
        {children}
      </div>
    </div>
  );
}
