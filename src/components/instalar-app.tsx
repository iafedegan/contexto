"use client";

import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, Compass, Copy, Download, Ellipsis, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

/**
 * Botón «Instalar app» (FM-04). Cómo se instala una PWA depende del aparato, y el botón se adapta:
 *
 * - Android, y Chrome/Edge en el computador: el navegador avisa con `beforeinstallprompt` cuando la app se puede instalar.
 *   Se guarda ese aviso (y se silencia el cartelito automático) y, al pulsar, se abre el cuadro de instalación del sistema.
 * - iPhone y iPad: Safari NO deja instalar desde un botón; la única vía es «Compartir → Agregar a pantalla de inicio». Aquí el
 *   botón abre una guía con los pasos EXACTOS de su versión de Safari (en iOS 26 el botón Compartir quedó detrás de «•••»), con un
 *   dibujo de cada botón y una flecha hacia la barra de Safari, que en el iPhone está abajo y en el iPad arriba.
 * - iPhone dentro de WhatsApp, Facebook, Instagram…: ese navegador interno NO puede instalar nada; la guía pide copiar el enlace
 *   y abrirlo en Safari (ahí se perdía la mayoría).
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

// Qué aparato es, para dar la guía correcta. Se lee solo en el navegador, al abrir la guía.
type InfoIos = {
  /** iPad: la barra de Safari está arriba y Compartir a la derecha. */
  ipad: boolean;
  /** Navegador interno de otra app (WhatsApp, Facebook…): no tiene «Safari/» en su identificación y no puede instalar. */
  interno: boolean;
  /** Versión mayor de Safari (26 o más: «•••» esconde Compartir); `null` si no se sabe (Chrome, Firefox…). */
  safari: number | null;
};

// iPhone, iPod y iPad (el iPad moderno se presenta como un Mac con pantalla táctil).
function esIos(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function leerIos(): InfoIos {
  const ua = navigator.userAgent;
  const otroNavegador = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
  const version = ua.match(/Version\/(\d+)/);
  return {
    ipad: /ipad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    interno: !otroNavegador && !/Safari\//.test(ua),
    safari: version && /Safari\//.test(ua) && !otroNavegador ? Number(version[1]) : null,
  };
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

// Un paso de la guía: el dibujo del botón que se toca y la frase corta.
type Paso = { icono: ReactNode; texto: string; aparte?: string };

// Los pasos de Safari, según la versión y el aparato.
function pasosSafari(info: InfoIos, locale: Locale): Paso[] {
  const marca = (n: ReactNode) => <span className="grid size-9 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--accent)]">{n}</span>;
  const compartir = marca(<Share size={18} aria-hidden />);
  const pasos: Paso[] = [];
  if (info.ipad) {
    pasos.push({ icono: compartir, texto: t(locale, "pwa.sShareTop") });
  } else if (info.safari !== null && info.safari >= 26) {
    // iOS 26: en la disposición por defecto («Compacta») Compartir está dentro de «•••».
    pasos.push({ icono: marca(<Ellipsis size={18} aria-hidden />), texto: t(locale, "pwa.s26Dots"), aparte: t(locale, "pwa.sIfShare") });
    pasos.push({ icono: compartir, texto: t(locale, "pwa.sShareMenu") });
  } else {
    pasos.push({ icono: compartir, texto: t(locale, "pwa.sShareBottom") });
  }
  pasos.push({ icono: marca(<SquarePlus size={18} aria-hidden />), texto: t(locale, "pwa.sScroll") });
  pasos.push({ icono: <span className="grid h-9 place-items-center rounded-full bg-[#0a84ff] px-3 text-xs font-bold text-white">{locale === "en" ? "Add" : "Agregar"}</span>, texto: t(locale, "pwa.sAdd") });
  return pasos;
}

export function InstalarApp({ locale, variante = "pildora" }: { locale: Locale; variante?: "pildora" | "banda" }) {
  const actual = useSyncExternalStore(suscribir, estado, () => "no" as Estado);
  const guia = useRef<HTMLDialogElement>(null);
  const [copiado, setCopiado] = useState(false);
  if (actual === "no") return null;

  // Abre el cuadro del sistema (Android, Chrome, Edge) o la guía paso a paso (iPhone y iPad).
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

  // Copia la dirección del sitio para pegarla en Safari.
  async function copiar() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      /* sin portapapeles: la dirección queda a la vista para copiarla a mano */
    }
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

  // La guía de iPhone/iPad solo se arma (y lee el navegador) cuando ese es el caso.
  const info = actual === "ios" ? leerIos() : null;

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

      {info && (
        <dialog
          ref={guia}
          aria-labelledby="pwa-ios-titulo"
          onClick={(e) => {
            if (e.target === e.currentTarget) e.currentTarget.close();
          }}
          // En el celular sube desde abajo, junto a la barra de Safari que hay que tocar; en pantallas grandes va centrada.
          className="m-0 mt-auto w-full max-w-none rounded-b-none rounded-t-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg)] p-0 text-[var(--fg)] shadow-2xl backdrop:bg-black/60 sm:m-auto sm:w-[min(92vw,28rem)] sm:rounded-[var(--radius-lg)]"
        >
          <div className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex items-start justify-between gap-3">
              <h2 id="pwa-ios-titulo" className="lx-display text-xl font-semibold leading-snug">
                {info.interno ? t(locale, "pwa.wvTitle") : t(locale, "pwa.iosTitle")}
              </h2>
              <button type="button" onClick={() => guia.current?.close()} aria-label={t(locale, "pwa.close")} className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--border)]">
                <X size={18} aria-hidden />
              </button>
            </div>

            {info.interno ? (
              <>
                <p className="text-sm text-[var(--fg-muted)]">{t(locale, "pwa.wvWhy")}</p>
                <ol className="flex flex-col gap-3 text-sm leading-relaxed">
                  <Numerado n={1} icono={<Copy size={18} aria-hidden />}>
                    {t(locale, "pwa.wv1")}
                  </Numerado>
                  <Numerado n={2} icono={<Compass size={18} aria-hidden />}>
                    {t(locale, "pwa.wv2")}
                  </Numerado>
                  <Numerado n={3} icono={<Ellipsis size={18} aria-hidden />}>
                    {t(locale, "pwa.wv3")}
                  </Numerado>
                  <Numerado n={4} icono={<Download size={18} aria-hidden />}>
                    {t(locale, "pwa.wv4")}
                  </Numerado>
                </ol>
                <button type="button" onClick={copiar} className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-fg)]">
                  {copiado ? <Check size={17} aria-hidden /> : <Copy size={17} aria-hidden />} {copiado ? t(locale, "pwa.copied") : t(locale, "pwa.copy")}
                </button>
                <input readOnly aria-label={t(locale, "pwa.copy")} value={typeof location === "undefined" ? "" : `${location.origin}/`} onFocus={(e) => e.currentTarget.select()} className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--fg-muted)]" />
              </>
            ) : (
              <>
                <p className="text-sm text-[var(--fg-muted)]">{t(locale, "pwa.iosIntro")}</p>
                <ol className="flex flex-col gap-3 text-sm leading-relaxed">
                  {pasosSafari(info, locale).map((p, i) => (
                    <Numerado key={p.texto} n={i + 1} icono={p.icono} aparte={p.aparte} crudo>
                      {p.texto}
                    </Numerado>
                  ))}
                </ol>
                <p className="rounded-[var(--radius)] bg-[var(--surface-2)] px-3 py-2.5 text-sm">{t(locale, "pwa.sOpen")}</p>
                {/* La barra de Safari está abajo en el iPhone y arriba (a la derecha) en el iPad: la flecha apunta hacia donde hay que tocar. */}
                <p className="flex items-center justify-center gap-2 text-xs font-semibold text-[var(--accent)]">
                  {info.ipad ? <ArrowUp size={16} className="motion-safe:animate-bounce" aria-hidden /> : <ArrowDown size={16} className="motion-safe:animate-bounce" aria-hidden />}
                  {info.ipad ? t(locale, "pwa.barTop") : t(locale, "pwa.barBottom")}
                </p>
              </>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}

// Un paso numerado con el dibujo del botón a la izquierda.
function Numerado({ n, icono, children, aparte, crudo = false }: { n: number; icono: ReactNode; children: ReactNode; aparte?: string; crudo?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      {crudo ? icono : <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--accent)]">{icono}</span>}
      <span className="min-w-0 flex-1 pt-1.5">
        <strong className="mr-1 tabular-nums">{n}.</strong>
        {children}
        {aparte && <span className="mt-1 block text-xs text-[var(--fg-muted)]">{aparte}</span>}
      </span>
    </li>
  );
}
