"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, ImagePlus, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { carpetasDeEntrega, entregarImagen, generarImagenesConIA } from "@/app/panel/(app)/imagenes/actions";
import { subirMedia } from "./subir-media";
import { SelectorCarpeta, type CarpetaNodo } from "./selector-carpeta";
import { VistaPreviaPortada } from "./vista-previa-portada";
import { AMBIENTES, CAMARAS, ESTILO_POR_DEFECTO, LUCES, PLANOS, TRATAMIENTOS, type EstiloEscena } from "@/lib/ai/prompt-escena";
import { ANCHO_PORTADA, aArchivo, renderizarPortada, type Ajuste } from "./ajustar-imagen";

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
export function EntregaImagen({ articleId, tituloNota = "", resumen = "" }: { articleId: string; tituloNota?: string; resumen?: string }) {
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
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ajuste, setAjuste] = useState<Ajuste>({ fx: 0.5, fy: 0.5, mejorar: true });
  const [ajustando, setAjustando] = useState(false);
  const [vistaAjuste, setVistaAjuste] = useState("");
  const [procesando, setProcesando] = useState(false);
  // Generar la imagen con IA (Nano Banana Pro).
  const [escena, setEscena] = useState("");
  // Fotos de referencia (máximo 3) que la IA combina con la nota.
  const [fotosRef, setFotosRef] = useState<string[]>([]);
  const [subiendoRef, setSubiendoRef] = useState(false);
  const [estilo, setEstilo] = useState<EstiloEscena>(ESTILO_POR_DEFECTO);
  const [opciones, setOpciones] = useState<string[]>([]);
  const [promptUsado, setPromptUsado] = useState("");
  const [generando, setGenerando] = useState(false);
  const [conIA, setConIA] = useState(false);
  const [datosIA, setDatosIA] = useState<{ alt: string; credito: string } | null>(null);
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
      if (conIA && datosIA) { if (pie === datosIA.credito) setPie(""); if (alt === datosIA.alt) setAlt(""); }
      setConIA(false);
      setArchivo(file);
      setAjustando(false);
      setBytes(file.size);
      setMedidas(null);
      if (!nombre) setNombre(nombreLegible(file.name));
    } catch {
      setError("No se pudo subir la imagen.");
    } finally {
      setSubiendo(false);
    }
  }

  // Elige una de las opciones generadas: pasa a ser la imagen a entregar (se completan los datos y se entrega como cualquier otra).
  async function elegirOpcion(direccion: string, datosIA?: { alt: string; credito: string }) {
    setUrl(direccion);
    setArchivo(null);
    setAjustando(false);
    setMedidas(null);
    setConIA(true);
    // El texto alternativo y el crédito de una imagen generada son los de la IA (se pueden editar).
    if (datosIA) { if (!alt.trim() || conIA) setAlt(datosIA.alt); if (!pie.trim() || conIA) setPie(datosIA.credito); }
    if (!nombre) setNombre(`Portada IA · ${tituloNota}`.slice(0, 60));
    // El peso se lee de la propia imagen, si el almacenamiento lo permite.
    try { const b = await (await fetch(direccion)).blob(); setBytes(b.size); } catch { setBytes(0); }
  }

  // Sube fotos de referencia hasta completar 3.
  async function alElegirReferencias(files: FileList) {
    setError("");
    const lista = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 3 - fotosRef.length);
    if (!lista.length) return;
    setSubiendoRef(true);
    try {
      const subidas: string[] = [];
      for (const f of lista) {
        const r = await subirMedia(f);
        if (!r.ok) { setError(r.error); break; }
        if (r.kind === "video") { setError("Solo fotos: un video no sirve de referencia."); break; }
        subidas.push(r.url);
      }
      if (subidas.length) setFotosRef((a) => [...a, ...subidas].slice(0, 3));
    } catch {
      setError("No se pudo subir la foto.");
    } finally {
      setSubiendoRef(false);
    }
  }

  // Pide tres opciones a la IA con la dirección de arte elegida (Nano Banana Pro): ya salen en WebP, 16:9 y de peso liviano.
  async function generar() {
    setError("");
    setGenerando(true);
    try {
      const r = await generarImagenesConIA({ articleId, escena, estilo, cantidad: 3, fotos: fotosRef });
      if (!r.ok) return setError(r.error);
      setOpciones(r.imagenes.map((i) => i.url));
      setPromptUsado(r.prompt);
      setDatosIA({ alt: r.alt, credito: r.credito });
      await elegirOpcion(r.imagenes[0].url, { alt: r.alt, credito: r.credito });
    } catch {
      setError("No se pudo generar la imagen. Inténtalo de nuevo.");
    } finally {
      setGenerando(false);
    }
  }

  // Vista previa del ajuste (pequeña, para que responda al mover el encuadre).
  useEffect(() => {
    if (!ajustando || !archivo) return;
    let vigente = true;
    const t = setTimeout(async () => {
      try {
        const lienzo = await renderizarPortada(archivo, ajuste, 640);
        if (vigente) setVistaAjuste(lienzo.toDataURL("image/jpeg", 0.8));
      } catch {
        if (vigente) setError("No se pudo preparar la vista previa del ajuste.");
      }
    }, 120);
    return () => { vigente = false; clearTimeout(t); };
  }, [ajustando, archivo, ajuste]);

  // Aplica el ajuste a tamaño completo y reemplaza la imagen por la nueva.
  async function aplicarAjuste() {
    if (!archivo) return;
    setError("");
    setProcesando(true);
    try {
      const lienzo = await renderizarPortada(archivo, ajuste, ANCHO_PORTADA);
      const nuevo = await aArchivo(lienzo, `${nombreLegible(archivo.name) || "portada"}-16x9`);
      const r = await subirMedia(nuevo);
      if (!r.ok) return setError(r.error);
      if (r.kind === "video") return setError("El resultado no es una imagen.");
      setUrl(r.url);
      setArchivo(nuevo);
      setBytes(nuevo.size);
      setMedidas(null);
      setAjustando(false);
    } catch {
      setError("No se pudo ajustar la imagen. Prueba con otra o sube una ya preparada.");
    } finally {
      setProcesando(false);
    }
  }

  const proporcion = medidas ? medidas.w / medidas.h : 0;
  const cumple = medidas ? medidas.w >= 1200 && Math.abs(proporcion - 16 / 9) < 0.06 : true;
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
    <div className="mt-3 flex flex-col gap-4 border-t border-[var(--border)] pt-4">
    <div className="grid gap-4 @container md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
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
            {bytes > 0 && <Requisito ok={bytes <= 1024 * 1024} texto={`Peso ${kb(bytes)}${bytes <= 1024 * 1024 ? "" : " · conviene bajar de 1 MB para que cargue rápido"}`} />}
          </ul>
        )}
        {url && archivo && !ajustando && (
          <button type="button" onClick={() => setAjustando(true)} className={`lx-btn self-start !px-3 !py-1.5 text-xs ${cumple ? "lx-btn-ghost" : ""}`}>
            <Wand2 size={13} /> {cumple ? "Mejorar la imagen" : "Ajustar a 16:9 y mejorar"}
          </button>
        )}
        {ajustando && archivo && (
          <div className="flex flex-col gap-2.5 rounded-[var(--radius)] border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3">
            <p className="text-xs font-semibold">Ajuste automático · {ANCHO_PORTADA} × {Math.round((ANCHO_PORTADA * 9) / 16)} px</p>
            {vistaAjuste ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vistaAjuste} alt="Vista previa del ajuste" className="aspect-[16/9] w-full rounded-[var(--radius)] border border-[var(--border)] object-cover" />
            ) : (
              <div className="grid aspect-[16/9] w-full place-items-center rounded-[var(--radius)] bg-[var(--surface-2)]"><Loader2 size={16} className="animate-spin text-[var(--fg-muted)]" /></div>
            )}
            {medidas && Math.abs(proporcion - 16 / 9) >= 0.02 && (
              <>
                <label className="flex flex-col gap-0.5 text-xs text-[var(--fg-muted)]">
                  {proporcion > 16 / 9 ? "Encuadre horizontal (qué parte se conserva)" : "Encuadre vertical (qué parte se conserva)"}
                  <input
                    type="range" min={0} max={100}
                    value={Math.round((proporcion > 16 / 9 ? ajuste.fx : ajuste.fy) * 100)}
                    onChange={(e) => { const v = Number(e.target.value) / 100; setAjuste((a) => (proporcion > 16 / 9 ? { ...a, fx: v } : { ...a, fy: v })); }}
                    aria-label="Encuadre"
                    className="w-full accent-[var(--accent)]"
                  />
                </label>
              </>
            )}
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={ajuste.mejorar} onChange={(e) => setAjuste((a) => ({ ...a, mejorar: e.target.checked }))} className="mt-0.5 accent-[var(--accent)]" />
              <span>Mejorar contraste y nitidez<span className="block text-[var(--fg-muted)]">Si la foto es muy pequeña quedará más limpia, pero no gana detalle nuevo.</span></span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={aplicarAjuste} disabled={procesando} className="lx-btn !px-3 !py-1.5 text-xs">{procesando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aplicar y reemplazar</button>
              <button type="button" onClick={() => setAjustando(false)} disabled={procesando} className="lx-link text-xs font-medium">Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* Datos para el buscador y carpeta de la biblioteca */}
      <div className="flex min-w-0 flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="lx-kicker text-[var(--fg-muted)]">Texto alternativo *</span>
            <span className={`text-[0.7rem] tabular-nums ${alt.trim().length > 125 ? "text-[#b45309]" : altOk ? "text-[#16a34a]" : "text-[var(--fg-muted)]"}`} title={alt.trim().length > 125 ? "Más de 125 caracteres: los lectores de pantalla y Google lo leen largo. Conviene resumirlo." : undefined}>{alt.trim().length}/125</span>
          </span>
          <textarea value={alt} onChange={(e) => setAlt(e.target.value.slice(0, 300))} rows={2} placeholder={`Qué se ve, con palabras clave si encajan. Ej.: «Ganado cebú pastando en una finca de los Llanos»`} className={`${campo} resize-none`} />
          <span className="text-xs text-[var(--fg-muted)]">Google lo usa para entender la imagen y es lo que leen los lectores con lector de pantalla. Describe, no repitas el título.</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="lx-kicker text-[var(--fg-muted)]">Pie de foto y crédito{conIA ? " · de la IA" : ""}</span>
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

    {/* Dirección de arte y generación con IA: tres opciones para elegir, con el prompt armado profesionalmente */}
    <section aria-label="Generar con IA" className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)]/40 p-3 sm:p-4">
      <header>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles size={14} aria-hidden className="text-[var(--accent)]" /> Generar con IA · Nano Banana Pro</h3>
        <p className="mt-0.5 text-xs text-[var(--fg-muted)]">Elige cómo se ve y la IA propone tres opciones. Cada una sale en WebP, 16:9 y de peso liviano, lista para publicar.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="lx-kicker text-[var(--fg-muted)]">Tratamiento</span>
              <select value={estilo.tratamiento} onChange={(e) => setEstilo((x) => ({ ...x, tratamiento: e.target.value as never }))} disabled={generando} className={campo}>
                {TRATAMIENTOS.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="lx-kicker text-[var(--fg-muted)]">Cámara y lente</span>
              <select value={estilo.camara} onChange={(e) => setEstilo((x) => ({ ...x, camara: e.target.value as never }))} disabled={generando} className={campo}>
                {CAMARAS.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="lx-kicker text-[var(--fg-muted)]">Plano</span>
              <select value={estilo.plano} onChange={(e) => setEstilo((x) => ({ ...x, plano: e.target.value as never }))} disabled={generando} className={campo}>
                {PLANOS.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="lx-kicker text-[var(--fg-muted)]">Luz</span>
              <select value={estilo.luz} onChange={(e) => setEstilo((x) => ({ ...x, luz: e.target.value as never }))} disabled={generando} className={campo}>
                {LUCES.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="lx-kicker text-[var(--fg-muted)]">Ambiente</span>
              <select value={estilo.ambiente} onChange={(e) => setEstilo((x) => ({ ...x, ambiente: e.target.value as never }))} disabled={generando} className={campo}>
                {AMBIENTES.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="lx-kicker text-[var(--fg-muted)]">Escena (opcional)</span>
          <textarea value={escena} onChange={(e) => setEscena(e.target.value.slice(0, 600))} rows={2} disabled={generando} placeholder="Qué debe verse. Si lo dejas vacío, la IA parte de la nota y de lo que se pidió." className={`${campo} resize-none`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="lx-kicker text-[var(--fg-muted)]">Indicaciones adicionales (opcional)</span>
          <textarea value={estilo.notas} onChange={(e) => setEstilo((x) => ({ ...x, notas: e.target.value.slice(0, 400) }))} rows={2} disabled={generando} placeholder="Ej.: cerca de madera, neblina en el fondo, sin personas…" className={`${campo} resize-none`} />
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <span className="lx-kicker text-[var(--fg-muted)]">Fotos de referencia (opcional, máximo 3)</span>
        <p className="text-xs text-[var(--fg-muted)]">La IA las combina con la nota y con la escena que escribas para componer las opciones.</p>
        <div className="flex flex-wrap gap-2">
          {fotosRef.map((u) => (
            <div key={u} className="relative size-24 overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="Foto de referencia" className="size-full object-cover" />
              <button type="button" onClick={() => setFotosRef((a) => a.filter((x) => x !== u))} disabled={generando} aria-label="Quitar esta foto" className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"><Trash2 size={12} /></button>
            </div>
          ))}
          {fotosRef.length < 3 && (
            <label className="grid size-24 cursor-pointer place-items-center rounded-[var(--radius)] border border-dashed border-[var(--border)] text-[var(--fg-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
              {subiendoRef ? <Loader2 size={18} className="animate-spin" /> : <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus size={18} aria-hidden />Añadir</span>}
              <input type="file" accept="image/*" multiple disabled={subiendoRef || generando} className="hidden" onChange={(e) => { const f = e.target.files; if (f) void alElegirReferencias(f); e.target.value = ""; }} />
            </label>
          )}
        </div>
      </div>
      <button type="button" onClick={generar} disabled={generando || subiendo || subiendoRef || pendiente} className="lx-btn self-start">
        {generando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {generando ? "Generando 3 opciones… unos 40 segundos" : opciones.length ? "Generar 3 opciones nuevas" : "Generar 3 opciones"}
      </button>
      {opciones.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold">Elige una opción</p>
          <div role="radiogroup" aria-label="Opciones generadas" className="grid gap-3 sm:grid-cols-3">
            {opciones.map((u, i) => (
              <button key={u} type="button" role="radio" aria-checked={url === u} onClick={() => void elegirOpcion(u, datosIA ?? undefined)} disabled={generando}
                className={`group relative overflow-hidden rounded-[var(--radius)] border-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 ${url === u ? "border-[var(--accent)] shadow-[var(--shadow)]" : "border-transparent hover:border-[var(--border-strong,var(--border))]"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`Opción ${i + 1}`} className="aspect-[16/9] w-full object-cover" />
                <span className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${url === u ? "bg-[var(--accent)] text-[var(--accent-fg,#fff)]" : "bg-black/55 text-white"}`}>{url === u && <Check size={11} />} Opción {i + 1}</span>
              </button>
            ))}
          </div>
          {conIA && <p className="text-[0.7rem] leading-snug text-[var(--fg-muted)]">Imagen generada con IA: se publica rotulada como tal. Revísala antes de entregarla.</p>}
          {promptUsado && (
            <details className="text-xs">
              <summary className="lx-link cursor-pointer font-medium">Ver el prompt armado</summary>
              <p className="mt-1.5 whitespace-pre-line rounded-[var(--radius)] bg-[var(--surface)] p-2.5 leading-relaxed text-[var(--fg-muted)]">{promptUsado}</p>
            </details>
          )}
        </div>
      )}
    </section>
    {url && <VistaPreviaPortada url={url} titulo={tituloNota || "Título de la nota"} resumen={resumen} pie={pie} alt={alt} />}
    <a href={`/vista-previa/${articleId}`} target="_blank" rel="noopener noreferrer" className="lx-link self-start text-xs font-medium">Ver la nota completa en una pestaña nueva →</a>
    </div>
  );
}
