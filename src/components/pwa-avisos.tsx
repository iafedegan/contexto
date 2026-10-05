"use client";

import { useEffect, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { esPwaInstalada, renovarSuscripcion, soportaPush, suscribirPush } from "@/lib/push-client";

// Clave donde se recuerda que la persona descartó los avisos.
const NO_KEY = "cg:avisos-no";
/** Tras un «Ahora no» no se vuelve a preguntar en dos semanas. */
const ESPERA_MS = 14 * 24 * 3600_000;
// Espera antes de mostrar el aviso, para no estorbar la lectura.
const RETRASO_MS = 8000;

/**
 * Bienvenida de notificaciones para quien abre el portal como app instalada (PWA).
 *
 * - Solo en la app instalada: en una pestaña normal el interruptor de la barra lateral sigue siendo la vía.
 * - Aparece unos segundos después de abrir, nunca al cargar, y se pide el permiso solo al pulsar el botón
 *   (los navegadores penalizan el permiso pedido de golpe).
 * - Si el lector ya había aceptado, solo renueva en silencio su registro en el servidor.
 */
export function PwaAvisos() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const [visible, setVisible] = useState(false);
  const [locale, setLocale] = useState<Locale>("es");
  const [fase, setFase] = useState<"pregunta" | "ocupado" | "hecho">("pregunta");

  useEffect(() => {
    // Al abrir la app se limpia la marca de «avisos sin leer» del ícono.
    (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.().catch(() => {});
    if (!publicKey || !soportaPush()) return;
    const ruta = window.location.pathname;
    if (ruta.startsWith("/panel") || ruta.startsWith("/vista-")) return;
    if (Notification.permission === "granted") return void renovarSuscripcion(publicKey);
    if (Notification.permission !== "default" || !esPwaInstalada()) return;
    try {
      if (Date.now() - Number(localStorage.getItem(NO_KEY) ?? 0) < ESPERA_MS) return;
    } catch {
      /* sin almacenamiento: se pregunta */
    }
    const espera = setTimeout(() => {
      setLocale(ruta === "/en" || ruta.startsWith("/en/") ? "en" : "es");
      setVisible(true);
    }, RETRASO_MS);
    return () => clearTimeout(espera);
  }, [publicKey]);

  // Oculta el aviso y recuerda la decisión.
  function descartar() {
    try {
      localStorage.setItem(NO_KEY, String(Date.now()));
    } catch {
      /* sin almacenamiento */
    }
    setVisible(false);
  }

  // Activa las notificaciones desde el aviso.
  async function activar() {
    setFase("ocupado");
    const r = await suscribirPush(publicKey);
    if (r === "activada") {
      setFase("hecho");
      setTimeout(() => setVisible(false), 3500);
    } else descartar();
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t(locale, "push.prompt.title")}
      className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--fg)] shadow-2xl sm:left-auto sm:right-4 sm:mx-0"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {fase === "hecho" ? (
        <p className="flex items-center gap-2 text-sm font-medium">
          <Check size={18} className="text-[var(--accent)]" /> {t(locale, "push.prompt.done")}
        </p>
      ) : (
        <>
          <button type="button" onClick={descartar} aria-label={t(locale, "push.prompt.no")} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)]">
            <X size={16} />
          </button>
          <p className="flex items-center gap-2 pr-6 text-sm font-semibold">
            <Bell size={18} className="text-[var(--accent)]" /> {t(locale, "push.prompt.title")}
          </p>
          <p className="mt-1.5 text-[0.82rem] leading-snug text-[var(--fg-muted)]">{t(locale, "push.prompt.body")}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={activar}
              disabled={fase === "ocupado"}
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-fg,#fff)] disabled:opacity-60"
            >
              {t(locale, "push.prompt.yes")}
            </button>
            <button type="button" onClick={descartar} className="inline-flex min-h-10 items-center rounded-full border border-[var(--border)] px-4 text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]">
              {t(locale, "push.prompt.no")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
