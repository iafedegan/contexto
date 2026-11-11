"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, ImagePlus, Loader2 } from "lucide-react";
import { carpetasDeEntrega, entregarImagen } from "@/app/panel/(app)/imagenes/actions";
import { subirMedia } from "./subir-media";
import { SelectorCarpeta, type CarpetaNodo } from "./selector-carpeta";

const campo = "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-muted)]/50";

type Medidas = { w: number; h: number };
const kb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
// «foto-final_v2.JPG» → «foto final v2»
const nombreLegible = (archivo: string) => archivo.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim();

/** Una línea de la revisión técnica de la imagen (lo que Google Discover y las búsquedas piden). */
function Requisito({ ok, texto }: { ok: boolean; texto: string }) {
  const Icono = ok ? CheckCircle2 : AlertTriangle;
  return (
    <li className={`flex items-start gap-1.5 text-xs ${ok ? "text-[#16a34a]" : "text-[#b45309]"}`}>
      <Icono size={13} aria-hidden className="mt-0.5 shrink-0" /> {texto}
    </li>
  );
}

// El diseñador sube la imagen, completa lo que pide el buscador (texto alternativo, pie con crédito, nombre) y elige la carpeta de la biblioteca donde queda; al entregar es la portada de la nota.
export function EntregaImagen({ articleId, tituloNota = "" }: { articleId: string; tituloNota?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [bytes, setBytes] = useState(0);
  const [medidas, setMedidas] = useState<Medidas | null>(null);
  const [alt, setAlt] = useState("");
  const [pie, setPie] = useState("");
  const [nombre, setNombre] = useState("");
  const [carpetaId, setCarpetaId] = useState("");
  const [carpetas, setCarpetas] = useState<CarpetaNodo[]>([]);
  const [gestiona, setGestiona] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();

  useEffect(() => {
    let vigente = true;
    carpetasDeEntrega().then((r) => { if (vigente) { setGestiona(r.gestiona); setCarpetas(r.carpetas); } }).catch(() => {});
    return () => { vigente = false; };
  }, []);

  async function alElegir(file: File) {
    setError("");
    setSubiendo(true);
    try {
      const r = await subirMedia(file);
      if (!r.ok) return setError(r.error);
      if (r.kind === "video") return setError("La portada debe ser una imagen.");
      setUrl(r.url);
      setBytes(file.size);
      setMedidas(null);
      if (!nombre) setNombre(nombreLegible(file.name));
    } catch {
      setError("No se pudo subir la imagen.");
    } finally {
      setSubiendo(false);
    }
  }

  const proporcion = medidas ? medidas.w / medidas.h : 0;
  const altOk = alt.trim().length >= 10;

  function entregar() {
    setError("");
    empezar(async () => {
      const r = await entregarImagen({ articleId, url, alt, pie, nombre, carpetaId: carpetaId || null, bytes });
      if (!r.ok) return setError(r.message);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 grid gap-4 border-t border-[var(--border)] pt-4 @container md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      {/* Vista previa y revisión técnica */}
      <div className="flex flex-col gap-2.5">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" onLoad={(e) => setMedidas({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} className="aspect-[16/9] w-full rounded-[var(--radius)] border border-[var(--border)] object-cover" />
        ) : (
          <div className="grid aspect-[16/9] w-full place-items-center rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)]/50 text-xs text-[var(--fg-muted)]">Sin imagen</div>
        )}
        <label className="lx-btn cursor-pointer self-start !px-3 !py-1.5 text-xs">
          {subiendo ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} {url ? "Cambiar imagen" : "Subir imagen"}
          <input type="file" accept="image/*" disabled={subiendo || pendiente} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void alElegir(f); }} />
        </label>
        {url && medidas && (
          <ul aria-label="Revisión de la imagen" className="flex flex-col gap-1">
            <Requisito ok={medidas.w >= 1200} texto={`${medidas.w} × ${medidas.h} px${medidas.w >= 1200 ? "" : " · Discover pide al menos 1200 px de ancho"}`} />
            <Requisito ok={Math.abs(proporcion - 16 / 9) < 0.06} texto={Math.abs(proporcion - 16 / 9) < 0.06 ? "Proporción 16:9" : "Proporción distinta de 16:9 (ideal para portada y redes)"} />
            <Requisito ok={bytes <= 1024 * 1024} texto={`Peso ${kb(bytes)}${bytes <= 1024 * 1024 ? "" : " · conviene bajar de 1 MB para que cargue rápido"}`} />
          </ul>
        )}
      </div>

      {/* Datos para el buscador y carpeta de la biblioteca */}
      <div className="flex min-w-0 flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="lx-kicker text-[var(--fg-muted)]">Texto alternativo *</span>
            <span className={`text-[0.7rem] tabular-nums ${altOk ? "text-[#16a34a]" : "text-[var(--fg-muted)]"}`}>{alt.trim().length}/125</span>
          </span>
          <textarea value={alt} onChange={(e) => setAlt(e.target.value.slice(0, 300))} rows={2} placeholder={`Qué se ve, con palabras clave si encajan. Ej.: «Ganado cebú pastando en una finca de los Llanos»`} className={`${campo} resize-none`} />
          <span className="text-xs text-[var(--fg-muted)]">Google lo usa para entender la imagen y es lo que leen los lectores con lector de pantalla. Describe, no repitas el título.</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="lx-kicker text-[var(--fg-muted)]">Pie de foto y crédito</span>
          <input value={pie} onChange={(e) => setPie(e.target.value.slice(0, 300))} placeholder="Ganado en la Orinoquía. Foto: Nombre Apellido / CONtexto Ganadero" className={campo} />
          <span className="text-xs text-[var(--fg-muted)]">Se muestra bajo la imagen en la nota. Incluye quién la hizo.</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="lx-kicker text-[var(--fg-muted)]">Nombre en la biblioteca</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value.slice(0, 120))} placeholder={tituloNota ? `Portada · ${tituloNota}`.slice(0, 60) : "ganado-cebu-llanos-portada"} className={campo} />
        </label>
        {gestiona && <SelectorCarpeta carpetas={carpetas} value={carpetaId} onChange={setCarpetaId} />}
        {error && <p role="alert" className="text-sm text-[var(--danger,#b4442e)]">{error}</p>}
        <button type="button" onClick={entregar} disabled={!url || !altOk || subiendo || pendiente} className="lx-btn self-start disabled:cursor-not-allowed disabled:opacity-50">
          {pendiente ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Entregar y poner en la nota
        </button>
        {url && !altOk && <p className="-mt-1 text-xs text-[var(--fg-muted)]">Falta el texto alternativo para poder entregar.</p>}
      </div>
    </div>
  );
}
