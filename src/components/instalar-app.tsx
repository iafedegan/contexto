"use client";

import { useRef, useSyncExternalStore } from "react";
import { Download, Plus, Share, Smartphone, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

/**
 * Botón «Instalar app» (FM-04). Cómo se instala una PWA depende del aparato, y el botón se adapta:
 *
 * - Android, y Chrome/Edge en el computador: el navegador avisa con `beforeinstallprompt` cuando la app se puede instalar.
 *   Se guarda ese aviso (y se silencia el cartelito automático) y, al pulsar, se abre el cuadro de instalación del sistema.
 * - iPhone y iPad: Safari NO deja instalar desde un botón; la única vía es «Compartir → Agregar a pantalla de inicio».
 *   Aquí el botón abre una guía de tres pasos.
 * - Ya instalada (abierta como app) o navegador sin soporte (Firefox de escritorio…): no se muestra nada.
 *
 * El aviso del navegador llega una sola vez y puede llegar antes de que el botón se pinte; por eso se captura al cargar
 * el módulo y los botones solo se suscriben al estado.
 */
type AvisoInstalacion = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Estado = "no" | "navegador" | "ios";

let aviso: AvisoInstalacion | null = null;
let instalada = false;
const oyentes = new Set<() => void>();
const notificar = () => oyentes.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    aviso = e as AvisoInstalacion;
    notificar();
  });
  window.addEventListener("appinstalled", () => {
    aviso = null;
    instalada = true;
    notificar();
  });
}

// La app ya está abierta como aplicación instalada (pantalla de inicio o ventana propia).
function yaInstalada(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: window-controls-overlay)").matches || nav.standalone === true;
}

// iPhone, iPod y iPad (el iPad moderno se presenta como un Mac con pantalla táctil).
function esIos(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// Qué ofrecer en este aparato ahora mismo.
function estado(): Estado {
  if (instalada || yaInstalada()) return "no";
  if (aviso) return "navegador";
  return esIos() ? "ios" : "no";
}

// Suscripción al estado de instalación.
function suscribir(f: () => void) {
  oyentes.add(f);
  return () => void oyentes.delete(f);
}

export function InstalarApp({ locale, variante = "pildora" }: { locale: Locale; variante?: "pildora" | "banda" }) {
  const actual = useSyncExternalStore(suscribir, estado, () => "no" as Estado);
  const guia = useRef<HTMLDialogElement>(null);
  if (actual === "no") return null;

  // Abre el cuadro del sistema (Android, Chrome, Edge) o la guía de tres pasos (iPhone y iPad).
  async function instalar() {
    if (aviso) {
      const a = aviso;
      aviso = null; // el aviso solo se puede usar una vez
      notificar();
      await a.prompt();
      const { outcome } = await a.userChoice;
      if (outcome === "accepted") {
        instalada = true;
        notificar();
      }
      return;
    }
    guia.current?.showModal();
  }

  const texto = variante === "pildora" ? t(locale, "pwa.install") : t(locale, "pwa.installFull");
  const boton =
    variante === "pildora" ? (
      <button
        type="button"
        onClick={instalar}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[var(--accent-fg)] pointer-coarse:min-h-11"
      >
        <Download size={13} aria-hidden /> {texto}
      </button>
    ) : (
      <button
        type="button"
        onClick={instalar}
        className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2.5 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90"
      >
        <Download size={17} aria-hidden /> {texto}
      </button>
    );

  return (
    <>
      {variante === "banda" ? (
        <section aria-label={t(locale, "pwa.bandTitle")} className="border-t border-[var(--border)] bg-[var(--bg)] text-[var(--fg)]">
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-full border border-[var(--border-strong)] text-[var(--accent)]">
                <Smartphone size={22} aria-hidden />
              </span>
              <div>
                <p className="lx-display text-lg font-semibold leading-snug">{t(locale, "pwa.bandTitle")}</p>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--fg-muted)]">{t(locale, "pwa.bandText")}</p>
              </div>
            </div>
            {boton}
          </div>
        </section>
      ) : (
        boton
      )}

      {actual === "ios" && (
        <dialog
          ref={guia}
          aria-labelledby="pwa-ios-titulo"
          onClick={(e) => {
            if (e.target === e.currentTarget) e.currentTarget.close();
          }}
          className="m-auto w-[min(92vw,26rem)] rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg)] p-0 text-[var(--fg)] shadow-2xl backdrop:bg-black/60"
        >
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 id="pwa-ios-titulo" className="lx-display text-xl font-semibold leading-snug">
                {t(locale, "pwa.iosTitle")}
              </h2>
              <button type="button" onClick={() => guia.current?.close()} aria-label={t(locale, "pwa.close")} className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--border)]">
                <X size={18} aria-hidden />
              </button>
            </div>
            <ol className="flex flex-col gap-3 text-sm leading-relaxed">
              {([
                [<Share key="s" size={16} aria-hidden />, "pwa.iosStep1"],
                [<Plus key="p" size={16} aria-hidden />, "pwa.iosStep2"],
                [<Download key="d" size={16} aria-hidden />, "pwa.iosStep3"],
              ] as const).map(([icono, clave], i) => (
                <li key={clave} className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--accent)]">{icono}</span>
                  <span className="pt-1">
                    <strong className="mr-1 tabular-nums">{i + 1}.</strong>
                    {t(locale, clave)}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-[var(--fg-muted)]">{t(locale, "pwa.iosNote")}</p>
          </div>
        </dialog>
      )}
    </>
  );
}
