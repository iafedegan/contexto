"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square } from "lucide-react";

/**
 * Campos de texto del panel con micrófono para dictar (el dictado lo hace el navegador con `SpeechRecognition`; el sitio solo recibe el texto).
 * El dictado se añade al final de lo ya escrito. Sin soporte del navegador, el micrófono no aparece.
 */
type Rec = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
};
const crear = (): Rec | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
};
const sinSuscripcion = () => () => {};

function useDictado(valor: string, onChange: (v: string) => void) {
  const soporta = useSyncExternalStore(sinSuscripcion, () => !!crear(), () => false);
  const [escuchando, setEscuchando] = useState(false);
  const rec = useRef<Rec | null>(null);
  const base = useRef("");
  const alternar = () => {
    if (escuchando) { rec.current?.stop(); return; }
    const r = crear();
    if (!r) return;
    base.current = valor.trim();
    r.lang = "es-CO"; r.interimResults = true; r.continuous = true;
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      onChange([base.current, t.trim()].filter(Boolean).join(" "));
    };
    r.onerror = () => setEscuchando(false);
    r.onend = () => { setEscuchando(false); rec.current = null; };
    rec.current = r;
    try { r.start(); setEscuchando(true); } catch { setEscuchando(false); }
  };
  return { soporta, escuchando, alternar };
}

function Micro({ soporta, escuchando, alternar, deshabilitado, arriba }: { soporta: boolean; escuchando: boolean; alternar: () => void; deshabilitado?: boolean; arriba?: boolean }) {
  if (!soporta) return null;
  return (
    <button type="button" disabled={deshabilitado} onClick={alternar} aria-pressed={escuchando} aria-label={escuchando ? "Detener el dictado" : "Dictar con el micrófono"} title={escuchando ? "Detener el dictado" : "Dictar"}
      className={`absolute right-2 grid size-9 place-items-center rounded-full border text-sm ${arriba ? "top-2" : "top-1/2 -translate-y-1/2"} ${escuchando ? "animate-pulse border-red-600 bg-red-600 text-white" : "border-[var(--border-strong)] bg-white text-[#0b0b0b] hover:bg-[var(--surface-2)]"} disabled:opacity-40`}>
      {escuchando ? <Square size={14} aria-hidden /> : <Mic size={15} aria-hidden />}
    </button>
  );
}

type Comunes = { value: string; onValue: (v: string) => void; className?: string };

export function InputVoz({ value, onValue, className = "", ...rest }: Comunes & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const d = useDictado(value, onValue);
  return (
    <div className="relative min-w-0 flex-1">
      <input {...rest} value={value} onChange={(e) => onValue(e.target.value)} className={`w-full ${className} ${d.soporta ? "pr-12" : ""}`} />
      <Micro {...d} deshabilitado={rest.disabled} />
    </div>
  );
}

export function AreaVoz({ value, onValue, className = "", ...rest }: Comunes & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const d = useDictado(value, onValue);
  return (
    <div className="relative">
      <textarea {...rest} value={value} onChange={(e) => onValue(e.target.value)} className={`${className} ${d.soporta ? "pr-12" : ""}`} />
      <Micro {...d} deshabilitado={rest.disabled} arriba />
    </div>
  );
}
