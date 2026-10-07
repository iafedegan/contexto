"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Voz para el asistente con lo que ya trae el navegador (sin servicios ni claves propias): dictado con `SpeechRecognition`
 * (Chrome, Edge, Safari; el navegador procesa el audio, el sitio solo recibe el texto) y lectura de la respuesta con
 * `speechSynthesis`. No hay palabra de activación («oye…»): la web no puede escuchar en segundo plano, se habla al pulsar el micrófono.
 */
type Reconocimiento = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type Constructor = new () => Reconocimiento;
const constructor = (): Constructor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Constructor; webkitSpeechRecognition?: Constructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export type Voz = {
  soportaDictado: boolean;
  soportaLectura: boolean;
  escuchando: boolean;
  leyendo: boolean;
  aviso: string;
  /** Empieza a escuchar; `alTexto` recibe lo que va entendiendo y `alTerminar` el texto final. */
  escuchar: (alTexto: (t: string) => void, alTerminar: (t: string) => void) => void;
  parar: () => void;
  leer: (texto: string) => void;
  callar: () => void;
};

export function useVoz(idioma = "es-CO"): Voz {
  // Qué admite el navegador: se lee en el cliente (en el servidor, falso) sin provocar un segundo pintado.
  const sinSuscripcion = () => () => {};
  const soportaDictado = useSyncExternalStore(sinSuscripcion, () => !!constructor(), () => false);
  const soportaLectura = useSyncExternalStore(sinSuscripcion, () => "speechSynthesis" in window, () => false);
  const [escuchando, setEscuchando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [aviso, setAviso] = useState("");
  const rec = useRef<Reconocimiento | null>(null);

  useEffect(() => {
    return () => { rec.current?.abort(); if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, []);

  const escuchar = useCallback((alTexto: (t: string) => void, alTerminar: (t: string) => void) => {
    const C = constructor();
    if (!C) return;
    window.speechSynthesis?.cancel();
    setAviso("");
    const r = new C();
    r.lang = idioma; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    let final = "";
    r.onresult = (e) => {
      let parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else parcial += t;
      }
      alTexto((final + parcial).trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setAviso("El navegador no tiene permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones.");
      else if (e.error === "no-speech") setAviso("No te escuché. Pulsa el micrófono y habla.");
      else if (e.error !== "aborted") setAviso("No pude usar el micrófono. Intenta de nuevo.");
    };
    r.onend = () => { setEscuchando(false); rec.current = null; if (final.trim()) alTerminar(final.trim()); };
    rec.current = r;
    try { r.start(); setEscuchando(true); } catch { setEscuchando(false); }
  }, [idioma]);

  const parar = useCallback(() => { rec.current?.stop(); }, []);

  const leer = useCallback((texto: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    // Sin las marcas de cita [1] ni los saltos: se lee como se hablaría.
    const limpio = texto.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim().slice(0, 1800);
    if (!limpio) return;
    const u = new SpeechSynthesisUtterance(limpio);
    u.lang = idioma; u.rate = 1.02;
    const voz = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("es-co")) ?? window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("es"));
    if (voz) u.voice = voz;
    u.onstart = () => setLeyendo(true);
    u.onend = () => setLeyendo(false);
    u.onerror = () => setLeyendo(false);
    window.speechSynthesis.speak(u);
  }, [idioma]);

  const callar = useCallback(() => { window.speechSynthesis?.cancel(); setLeyendo(false); }, []);

  return { soportaDictado, soportaLectura, escuchando, leyendo, aviso, escuchar, parar, leer, callar };
}
