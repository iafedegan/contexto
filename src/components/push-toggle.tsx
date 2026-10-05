"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { suscribirPush } from "@/lib/push-client";

/**
 * Suscripción a avisos de última hora (FM-01).
 *
 * Nunca se pide el permiso al cargar la página: los navegadores penalizan esa
 * práctica y el lector la vive como intrusiva. El permiso se solicita cuando
 * pulsa el botón, que es cuando ha expresado interés.
 */
export function PushToggle({ locale, publicKey }: { locale: Locale; publicKey: string }) {
  const [estado, setEstado] = useState<"desconocido" | "no" | "si" | "bloqueado">("desconocido");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      if (Notification.permission === "denied") {
        if (vivo) setEstado("bloqueado");
        return;
      }
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const sub = await reg?.pushManager.getSubscription().catch(() => null);
      if (vivo) setEstado(sub ? "si" : "no");
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Activa o desactiva las notificaciones de este navegador.
  async function alternar() {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const actual = await reg.pushManager.getSubscription();

      if (actual) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: actual.endpoint }),
        });
        await actual.unsubscribe();
        setEstado("no");
        return;
      }

      const r = await suscribirPush(publicKey);
      if (r === "bloqueada") return void setEstado("bloqueado");
      if (r !== "activada") return void setEstado("no");
      setEstado("si");
    } catch {
      setEstado("no");
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "desconocido" || !publicKey) return null;

  if (estado === "bloqueado") {
    return (
      <p className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
        <BellOff size={14} /> {t(locale, "push.blocked")}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={ocupado}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] px-4 text-sm font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
    >
      {ocupado ? (
        <Loader2 size={15} className="animate-spin" />
      ) : estado === "si" ? (
        <BellOff size={15} />
      ) : (
        <Bell size={15} />
      )}
      {estado === "si" ? t(locale, "push.off") : t(locale, "push.on")}
    </button>
  );
}
