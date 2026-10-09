"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as EventoPuntero } from "react";
import { usePathname } from "next/navigation";
import { RotateCcw, X } from "lucide-react";
import { ToroBot } from "@/components/toro-bot";
import { AssistantChat } from "@/components/assistant-chat";
import { LogoMark } from "@/components/logo-mark";
import { limitarPosicion, ubicarDialogo, type Lado, type Posicion } from "@/lib/toro-posicion";

/**
 * Avatar flotante del asistente: el toro de caricatura, fijo en la esquina inferior derecha de todo el
 * portal (en el celular no: ahí es la pestaña central de la barra inferior, `MobileTabBar`, y no tapa la lectura).
 * Al tocarlo abre el asistente. No aparece en el propio asistente ni se queda tapando: tiene
 * una «x» para ocultarlo hasta la siguiente carga.
 *
 * Se puede arrastrar a cualquier parte de la pantalla (desde el toro o desde la cabecera del cuadro del chat); queda donde se
 * soltó, también en la próxima visita, y nunca se sale de la pantalla. Con el foco en el toro, Alt + flechas lo mueve.
 */
const CLAVE = "cg_toro_pos";
// Tamaño del toro: `w-[5.25rem]` y `sm:w-28`; el alto sale de la proporción de su dibujo (240 × 230).
const ancho = (anchoPantalla: number) => (anchoPantalla >= 640 ? 112 : 84);
const alto = (anchoPantalla: number) => Math.round((ancho(anchoPantalla) * 230) / 240);

// Lugar guardado del toro (`null`: su esquina de siempre). Se lee una vez y se avisa a los suscritos al cambiar.
let guardada: Posicion | null | undefined;
const oyentes = new Set<() => void>();
function leerGuardada(): Posicion | null {
  if (guardada === undefined) {
    try {
      const v = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as Partial<Posicion> | null;
      guardada = v && Number.isFinite(v.x) && Number.isFinite(v.y) ? { x: v.x as number, y: v.y as number } : null;
    } catch {
      guardada = null;
    }
  }
  return guardada;
}
function guardar(p: Posicion | null) {
  guardada = p;
  try {
    if (p) localStorage.setItem(CLAVE, JSON.stringify(p));
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento (navegación privada): queda para esta visita.
  }
  oyentes.forEach((f) => f());
}
const suscribirGuardada = (f: () => void) => {
  oyentes.add(f);
  return () => void oyentes.delete(f);
};

// Tamaño de la ventana; el objeto no cambia mientras no cambie el tamaño (lo exige `useSyncExternalStore`).
const VENTANA_SERVIDOR = { w: 1280, h: 800 };
let ventana = VENTANA_SERVIDOR;
function leerVentana() {
  if (ventana.w !== window.innerWidth || ventana.h !== window.innerHeight) ventana = { w: window.innerWidth, h: window.innerHeight };
  return ventana;
}
const suscribirVentana = (f: () => void) => {
  window.addEventListener("resize", f);
  return () => window.removeEventListener("resize", f);
};

// Gesto de arrastre en curso: desde dónde empezó y cuánto se ha movido (un toque sin moverse sigue siendo un clic).
type Gesto = { id: number; x0: number; y0: number; ox: number; oy: number; activo: boolean; lado: Lado };

export function ToroFlotante() {
  const pathname = usePathname() ?? "";
  const [oculto, setOculto] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [arrastre, setArrastre] = useState<Posicion | null>(null);
  const guardadaAhora = useSyncExternalStore(suscribirGuardada, leerGuardada, () => null);
  const vp = useSyncExternalStore(suscribirVentana, leerVentana, () => VENTANA_SERVIDOR);
  const envoltura = useRef<HTMLDivElement>(null);
  const gesto = useRef<Gesto | null>(null);
  const ultima = useRef<Posicion | null>(null);
  // El último gesto fue un arrastre: el clic que lo cierra no abre ni cierra el chat.
  const movido = useRef(false);

  useEffect(() => {
    if (!abierto) return;
    // Cierra el panel con la tecla Escape.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [abierto]);

  const en = pathname === "/en" || pathname.startsWith("/en/");
  if (oculto || /\/asistente(\/|$)/.test(pathname)) return null;
  const etiqueta = en ? "Ask the archive assistant" : "Pregúntale al asistente";

  const W = ancho(vp.w);
  const H = alto(vp.w);
  // Tamaño del cuadro del chat cuando el toro no está en su esquina (en la esquina lo fijan las clases de abajo).
  const cuadro = { w: Math.min(416, vp.w - 24), h: Math.min(544, vp.h - 16) };
  // Dónde está el toro ahora: el arrastre en curso, o lo guardado ajustado a la ventana de hoy (puede haberse hecho más pequeña).
  const pos = arrastre ?? (guardadaAhora ? limitarPosicion(guardadaAhora, vp, { w: W, h: H }) : null);
  const dialogo = pos ? ubicarDialogo(pos, vp, { w: W, h: H }, cuadro) : null;

  // Empieza un gesto sobre el toro o la cabecera del cuadro.
  function iniciar(e: EventoPuntero<HTMLElement>) {
    if (e.button !== 0) return;
    const r = envoltura.current?.getBoundingClientRect();
    if (!r) return;
    movido.current = false;
    gesto.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, ox: r.left, oy: r.top, activo: false, lado: dialogo?.lado ?? "arriba" };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  // Mueve el toro tras el puntero; hasta moverse 5 px sigue siendo un clic.
  function mover(e: EventoPuntero<HTMLElement>) {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.activo && Math.hypot(dx, dy) < 5) return;
    g.activo = true;
    // Con el chat abierto el toro no puede ir tan lejos que el cuadro se salga (el lado del cuadro queda fijo mientras se arrastra).
    const siguiente = limitarPosicion({ x: g.ox + dx, y: g.oy + dy }, vp, { w: W, h: H }, abierto ? { cuadro, lado: g.lado } : undefined);
    ultima.current = siguiente;
    setArrastre(siguiente);
  }
  // Termina el gesto: si hubo arrastre, el lugar queda guardado.
  function soltar(e: EventoPuntero<HTMLElement>) {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    gesto.current = null;
    if (!g.activo) return;
    movido.current = true;
    if (ultima.current) guardar(ultima.current);
    ultima.current = null;
    setArrastre(null);
  }
  // Alt + flechas mueve el toro con el teclado.
  function alTeclear(e: React.KeyboardEvent<HTMLButtonElement>) {
    const paso = 24;
    const mueve = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
    if (!e.altKey || !mueve) return;
    e.preventDefault();
    const r = envoltura.current?.getBoundingClientRect();
    if (!r) return;
    guardar(limitarPosicion({ x: r.left + mueve[0], y: r.top + mueve[1] }, vp, { w: W, h: H }, abierto ? { cuadro, lado: dialogo?.lado ?? "arriba" } : undefined));
  }

  return (
    <>
      {montado && (
        <div
          id="toro-dialogo"
          role="dialog"
          aria-label={en ? "Archive assistant" : "Asistente del archivo"}
          hidden={!abierto}
          style={dialogo ? { left: dialogo.x, top: dialogo.y, right: "auto", bottom: "auto", width: cuadro.w, height: cuadro.h } : undefined}
          className="toro-dialogo max-md:hidden fixed bottom-[max(9rem,calc(env(safe-area-inset-bottom)+8.5rem))] right-[max(0.75rem,env(safe-area-inset-right))] z-30 flex h-[min(34rem,calc(100dvh-11.5rem))] w-[min(26rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg)] text-[var(--fg)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] print:hidden"
        >
          <div
            onPointerDown={(e) => { if (!(e.target as HTMLElement).closest("button")) iniciar(e); }}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            title={en ? "Drag to move" : "Arrastra para mover"}
            className="flex shrink-0 cursor-grab touch-none select-none items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-2)] px-4 py-3 active:cursor-grabbing"
          >
            <LogoMark size={26} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">{en ? "Archive assistant" : "Asistente del archivo"}</p>
              <p className="truncate text-[0.72rem] text-[var(--fg-muted)]">{en ? "Answers with cited sources" : "Respuestas con fuente citada"}</p>
            </div>
            {guardadaAhora && (
              <button type="button" onClick={() => guardar(null)} aria-label={en ? "Back to the corner" : "Volver a la esquina"} title={en ? "Back to the corner" : "Volver a la esquina"} className="grid size-9 place-items-center rounded-full border border-[var(--border)] transition hover:bg-[var(--surface-2)]">
                <RotateCcw size={15} />
              </button>
            )}
            <button type="button" onClick={() => setAbierto(false)} aria-label={en ? "Close" : "Cerrar"} className="grid size-9 place-items-center rounded-full border border-[var(--border)] transition hover:bg-[var(--surface-2)]">
              <X size={16} />
            </button>
          </div>
          <div className="min-h-0 flex-1 p-3">
            <AssistantChat compact />
          </div>
        </div>
      )}
    <div
      ref={envoltura}
      style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
      className="toro-wrap pointer-events-none max-md:hidden fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-30 print:hidden"
    >
      <div className="group pointer-events-auto relative">
        <button
          type="button"
          onClick={() => setOculto(true)}
          aria-label={en ? "Hide the assistant" : "Ocultar el asistente"}
          className="absolute -right-1 -top-1 z-10 grid size-7 place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-2)] text-[var(--fg-muted)] opacity-90 shadow transition hover:text-[var(--fg)] pointer-fine:size-5 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
        >
          <X size={12} />
        </button>
        <button
          type="button"
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          onKeyDown={alTeclear}
          onClick={() => {
            // El clic que cierra un arrastre no cuenta.
            if (movido.current) {
              movido.current = false;
              return;
            }
            setMontado(true);
            setAbierto((v) => !v);
          }}
          aria-label={etiqueta}
          aria-expanded={abierto}
          aria-controls="toro-dialogo"
          aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
          className="toro-float block w-[5.25rem] cursor-grab touch-none transition-transform hover:scale-110 active:cursor-grabbing sm:w-28"
        >
          <ToroBot bubble={false} label={etiqueta} />
        </button>
        <span className="pointer-events-none absolute bottom-full right-0 mb-1 hidden whitespace-nowrap rounded-full border border-[var(--border-strong)] bg-[var(--bg-2)] px-3 py-1 text-xs font-medium text-[var(--fg)] opacity-0 shadow transition group-hover:opacity-100 pointer-fine:block">
          {etiqueta}
        </span>
      </div>
    </div>
    </>
  );
}
