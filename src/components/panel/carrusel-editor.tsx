"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronDown, ImagePlus, Info, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { subirMedia } from "@/components/panel/subir-media";
import { videosDelInicio } from "@/app/panel/(app)/portada/actions";
import { CARRUSEL_MAX_DIAPOSITIVAS, CARRUSEL_MAX_EXTRA, resumenCarrusel, sanitizeCarrusel, sanitizeCarruseles, type CarruselConfig, type Diapositiva } from "@/lib/carrusel";

/**
 * Carrusel de notas de la portada, dentro del editor: de dónde salen las notas, cuántas tarjetas se ven en cada pantalla, el estilo
 * de cada tarjeta, el paso automático, la transición, las flechas, los indicadores y los colores. Los cambios se ven al instante en el
 * lienzo y se publican con «Publicar cambios», como el resto del diseño. Vale para todas las plantillas.
 */
// Identificador provisional de una diapositiva nueva (se genera al subir la foto, no al dibujar).
const nuevoId = () => `d-${Math.random().toString(36).slice(2, 8)}`;

export function CarruselEditor({
  value,
  onChange,
  secciones,
}: {
  value: CarruselConfig | undefined;
  onChange: (next: Required<CarruselConfig>) => void;
  /** Secciones del sitio para elegir de cuál salen las notas. */
  secciones: { slug: string; name: string }[];
}) {
  const v = sanitizeCarrusel(value);
  const set = (p: Partial<CarruselConfig>) => onChange(sanitizeCarrusel({ ...v, ...p }));

  return (
    <div className="flex flex-col gap-3 text-sm">
      {/* Interruptor: grande y con su explicación, para que se entienda qué hace sin probarlo. */}
      <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-3 transition ${v.activo ? "border-[var(--accent)] bg-[var(--accent)]/8" : "border-[var(--border-strong)]"}`}>
        <span className="min-w-0">
          <span className="block font-semibold">{v.activo ? "Carrusel encendido" : "Carrusel apagado"}</span>
          <span className="block text-xs text-[var(--fg-muted)]">{v.activo ? "Se ve en la portada al publicar los cambios." : "No se ve en la portada. Puedes prepararlo y encenderlo cuando esté listo."}</span>
        </span>
        <input type="checkbox" role="switch" checked={v.activo} onChange={(e) => set({ activo: e.target.checked })} className="peer sr-only" />
        <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full transition ${v.activo ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"} peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--accent)]`}>
          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${v.activo ? "left-[1.375rem]" : "left-0.5"}`} />
        </span>
      </label>

      {/* Las fotos de TV y de Fedegán que salen bajo las destacadas no son de este carrusel: vienen de la página «Portada del inicio». */}
      <p className="flex gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2.5 text-xs leading-relaxed text-[var(--fg-muted)]">
        <Info size={14} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden />
        <span>
          ¿Buscas los carruseles de fotos o de TV que salen bajo las notas destacadas? Esos se editan en{" "}
          <Link href="/panel/paginas" className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">Páginas › Portada del inicio</Link>. Este interruptor los muestra u oculta a todos.
        </span>
      </p>

      <Grupo titulo="Fotos propias" resumen={`${v.diapositivas.length} de ${CARRUSEL_MAX_DIAPOSITIVAS}${v.fotosActivo ? "" : " · apagado"}`}>
        <Interruptor activo={v.fotosActivo} nombre="Carrusel de fotos" onChange={(fotosActivo) => set({ fotosActivo })} />
        <Diapositivas lista={v.diapositivas} onChange={(diapositivas) => set({ diapositivas })} />
        {v.diapositivas.length > 0 && v.fuente !== "propias" && (
          <Opciones
            etiqueta="Dónde van respecto a las notas"
            valor={v.propiasPosicion}
            opciones={[
              ["antes", "Primero las mías"],
              ["despues", "Primero las notas"],
            ]}
            onChange={(propiasPosicion) => set({ propiasPosicion })}
          />
        )}
      </Grupo>

      <Grupo titulo="Videos de TV (YouTube)" resumen={`${v.videos.length} de ${CARRUSEL_MAX_DIAPOSITIVAS}${v.videosActivo ? "" : " · apagado"}`}>
        <Interruptor activo={v.videosActivo} nombre="Carrusel de videos" onChange={(videosActivo) => set({ videosActivo })} />
        <Videos lista={v.videos} onChange={(videos) => set({ videos })} />
      </Grupo>

      <Grupo titulo="Título y lugar en la portada" resumen={v.titulo || "Sin título"}>
        <input value={v.titulo} onChange={(e) => set({ titulo: e.target.value })} maxLength={60} placeholder="Título sobre el carrusel (vacío = sin título)" className="lx-input !py-1.5 !text-xs" />
        <Opciones
          etiqueta="Dónde va en la portada"
          valor={v.posicion}
          opciones={[
            ["arriba", "Arriba, bajo el cintillo"],
            ["tras-en-vivo", "Tras el bloque «En vivo»"],
            ["tras-principal", "Tras la nota principal"],
            ["abajo", "Al final, antes del pie"],
          ]}
          onChange={(posicion) => set({ posicion })}
        />
      </Grupo>

        <Grupo titulo="Notas del sitio" resumen={v.fuente === "propias" ? "Ninguna" : `${v.cantidad} notas`}>
          <Opciones
            etiqueta="De dónde salen"
            valor={v.fuente}
            opciones={[
              ["portada", "Como la portada"],
              ["recientes", "Las más recientes"],
              ["masleidas", "Las más leídas"],
              ["seccion", "De una sección"],
              ["propias", "Ninguna: solo mis diapositivas"],
            ]}
            onChange={(fuente) => set({ fuente, ...(fuente === "seccion" && !v.seccion ? { seccion: secciones[0]?.slug ?? "" } : {}) })}
          />
          {v.fuente === "seccion" && (
            <select value={v.seccion} onChange={(e) => set({ seccion: e.target.value })} aria-label="Sección de las notas" className="lx-input mt-2 !py-1.5 !text-xs">
              {secciones.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {v.fuente !== "propias" && <Deslizador etiqueta="Cuántas notas" valor={v.cantidad} min={3} max={20} texto={String(v.cantidad)} onChange={(cantidad) => set({ cantidad })} />}
          <Casilla etiqueta="Solo notas que tengan foto" valor={v.soloConFoto} onChange={(soloConFoto) => set({ soloConFoto })} />
        </Grupo>

        <Grupo titulo="Tamaño y tarjetas visibles">
          <Deslizador etiqueta="En computador" valor={v.visiblesEscritorio} min={1} max={5} texto={String(v.visiblesEscritorio)} onChange={(visiblesEscritorio) => set({ visiblesEscritorio })} />
          <Deslizador etiqueta="En tableta" valor={v.visiblesTableta} min={1} max={3} texto={String(v.visiblesTableta)} onChange={(visiblesTableta) => set({ visiblesTableta })} />
          <Deslizador etiqueta="En celular" valor={v.visiblesCelular} min={1} max={2} texto={String(v.visiblesCelular)} onChange={(visiblesCelular) => set({ visiblesCelular })} />
          <Deslizador etiqueta="Ancho máximo del carrusel" valor={v.ancho} min={480} max={1800} step={20} texto={`${v.ancho} px`} onChange={(ancho) => set({ ancho })} />
          <Deslizador etiqueta="Desenfoque de los extremos" valor={v.desenfoqueBordes} min={0} max={24} texto={v.desenfoqueBordes === 0 ? "sin desenfoque" : `${v.desenfoqueBordes} px`} onChange={(desenfoqueBordes) => set({ desenfoqueBordes })} />
          <Deslizador etiqueta="Separación entre tarjetas" valor={v.separacion} min={0} max={40} texto={`${v.separacion} px`} onChange={(separacion) => set({ separacion })} />
        </Grupo>

        <Grupo titulo="Diseño de la tarjeta">
          <Opciones
            etiqueta="Estilo"
            valor={v.estilo}
            opciones={[
              ["superpuesta", "Texto sobre la foto"],
              ["debajo", "Foto y texto debajo"],
              ["solo-imagen", "Solo foto (texto al pasar el puntero)"],
            ]}
            onChange={(estilo) => set({ estilo })}
          />
          <Opciones
            etiqueta="Proporción de la foto"
            valor={v.aspecto}
            opciones={[
              ["21:9", "Panorámica 21:9"],
              ["16:9", "16:9"],
              ["3:2", "3:2"],
              ["4:3", "4:3"],
              ["1:1", "Cuadrada"],
            ]}
            onChange={(aspecto) => set({ aspecto })}
          />
          <Deslizador etiqueta="Tamaño del titular" valor={v.tamanoTitular} min={14} max={40} texto={`${v.tamanoTitular} px`} onChange={(tamanoTitular) => set({ tamanoTitular })} />
          <Deslizador etiqueta="Esquinas redondeadas" valor={v.redondeo} min={0} max={32} texto={`${v.redondeo} px`} onChange={(redondeo) => set({ redondeo })} />
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
            <Casilla etiqueta="Sección" valor={v.mostrarCategoria} onChange={(mostrarCategoria) => set({ mostrarCategoria })} />
            <Casilla etiqueta="Resumen" valor={v.mostrarResumen} onChange={(mostrarResumen) => set({ mostrarResumen })} />
            <Casilla etiqueta="Autor" valor={v.mostrarAutor} onChange={(mostrarAutor) => set({ mostrarAutor })} />
            <Casilla etiqueta="Fecha" valor={v.mostrarFecha} onChange={(mostrarFecha) => set({ mostrarFecha })} />
          </div>
        </Grupo>

        <Grupo titulo="Movimiento">
          <Casilla etiqueta="Pasa solo" valor={v.autoplay} onChange={(autoplay) => set({ autoplay })} />
          {v.autoplay && (
            <>
              <Deslizador etiqueta="Segundos entre cambios" valor={v.intervalo} min={2} max={20} texto={`${v.intervalo} s`} onChange={(intervalo) => set({ intervalo })} />
              <Casilla etiqueta="Se detiene al pasar el puntero o enfocar" valor={v.pausarAlPasar} onChange={(pausarAlPasar) => set({ pausarAlPasar })} />
              <Casilla etiqueta="Barra de progreso hasta el siguiente cambio" valor={v.barraProgreso} onChange={(barraProgreso) => set({ barraProgreso })} />
            </>
          )}
          <Casilla etiqueta="Al llegar al final vuelve al principio" valor={v.bucle} onChange={(bucle) => set({ bucle })} />
          <Opciones
            etiqueta="Cuánto avanza cada vez"
            valor={v.avance}
            opciones={[
              ["una", "Una tarjeta"],
              ["pagina", "Una página completa"],
            ]}
            onChange={(avance) => set({ avance })}
          />
          <Opciones
            etiqueta="Transición"
            valor={v.transicion}
            opciones={[
              ["deslizar", "Deslizar"],
              ["fundido", "Fundido (una tarjeta a la vez)"],
            ]}
            onChange={(transicion) => set({ transicion })}
          />
          <Deslizador etiqueta="Duración de la transición" valor={v.duracion} min={200} max={1500} step={50} texto={`${v.duracion} ms`} onChange={(duracion) => set({ duracion })} />
        </Grupo>

        <Grupo titulo="Flechas e indicadores">
          <Opciones
            etiqueta="Flechas"
            valor={v.flechas}
            opciones={[
              ["hover", "Al pasar el puntero"],
              ["siempre", "Siempre"],
              ["nunca", "Ocultas"],
            ]}
            onChange={(flechas) => set({ flechas })}
          />
          <Opciones
            etiqueta="Indicador de posición"
            valor={v.indicador}
            opciones={[
              ["puntos", "Puntos"],
              ["barras", "Barras"],
              ["numero", "Número (2 / 5)"],
              ["ninguno", "Ninguno"],
            ]}
            onChange={(indicador) => set({ indicador })}
          />
        </Grupo>

        <Grupo titulo="Colores">
          <Color etiqueta="Fondo" valor={v.colorFondo} onChange={(colorFondo) => set({ colorFondo })} vacio="Sin fondo (el del tema)" />
          <Color etiqueta="Texto" valor={v.colorTexto} onChange={(colorTexto) => set({ colorTexto })} vacio="El del tema" />
          <Color etiqueta="Acento (título, sección, flechas)" valor={v.colorAcento} onChange={(colorAcento) => set({ colorAcento })} vacio="El del tema" />
        </Grupo>
    </div>
  );
}

// Un grupo de controles que se abre y se cierra (en el celular, todo abierto a la vez era una columna interminable).
function Grupo({ titulo, resumen, abierto = false, children }: { titulo: string; resumen?: string; abierto?: boolean; children: ReactNode }) {
  return (
    <details open={abierto} className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-3 select-none">
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wide">{titulo}</span>
          {resumen && <span className="block truncate text-xs text-[var(--fg-muted)]">{resumen}</span>}
        </span>
        <ChevronDown size={16} className="shrink-0 text-[var(--fg-muted)] transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-[var(--border)] px-3.5 pt-1 pb-3.5">{children}</div>
    </details>
  );
}

// Fila de botones para elegir una opción entre varias.
function Opciones<T extends string>({ etiqueta, valor, opciones, onChange }: { etiqueta: string; valor: T; opciones: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="mt-2">
      <p className="mb-1 text-xs text-[var(--fg-muted)]">{etiqueta}</p>
      <div className="flex flex-wrap gap-1">
        {opciones.map(([id, texto]) => (
          <button
            key={id}
            type="button"
            aria-pressed={valor === id}
            onClick={() => onChange(id)}
            className={`rounded-md border px-2.5 py-1 text-xs transition ${valor === id ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"}`}
          >
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}

// Casilla de sí o no.
function Casilla({ etiqueta, valor, onChange }: { etiqueta: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-1.5 flex items-center gap-2 text-xs">
      <input type="checkbox" checked={valor} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--accent)]" />
      {etiqueta}
    </label>
  );
}

// Deslizador con su etiqueta y el valor a la derecha.
function Deslizador({ etiqueta, valor, min, max, step = 1, texto, onChange }: { etiqueta: string; valor: number; min: number; max: number; step?: number; texto: string; onChange: (n: number) => void }) {
  return (
    <label className="mt-2 block text-xs">
      <span className="flex justify-between">
        <span className="text-[var(--fg-muted)]">{etiqueta}</span>
        <span className="font-semibold tabular-nums">{texto}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={valor} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[var(--accent)]" />
    </label>
  );
}

// Selector de color con «volver al del tema».
function Color({ etiqueta, valor, onChange, vacio }: { etiqueta: string; valor: string; onChange: (v: string) => void; vacio: string }) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <input type="color" aria-label={etiqueta} value={valor || "#888888"} onChange={(e) => onChange(e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-[var(--border-strong)] bg-white p-0.5" />
      <span className="min-w-0 flex-1 text-xs">
        <span className="block font-medium">{etiqueta}</span>
        <span className="block text-[var(--fg-muted)]">{valor || vacio}</span>
      </span>
      {valor && (
        <button type="button" onClick={() => onChange("")} className="text-xs font-semibold text-[var(--accent)] hover:underline">
          Quitar
        </button>
      )}
    </div>
  );
}

// Fotos propias del carrusel: un contador «N de 12» siempre a la vista, cada foto numerada con su miniatura y sus botones (subir, bajar,
// editar textos, eliminar), varias fotos de una vez y un aviso claro cuando se llega al máximo. Los textos se guardan al salir del campo.
function Diapositivas({ lista, onChange }: { lista: Diapositiva[]; onChange: (d: Diapositiva[]) => void }) {
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [confirmarTodas, setConfirmarTodas] = useState(false);
  const max = CARRUSEL_MAX_DIAPOSITIVAS;
  const libres = max - lista.length;
  const lleno = libres <= 0;

  // Cambia un campo de una diapositiva.
  const cambiar = (id: string, p: Partial<Diapositiva>) => onChange(lista.map((d) => (d.id === id ? { ...d, ...p } : d)));
  // Mueve una diapositiva una posición.
  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    const copia = lista.slice();
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onChange(copia);
  };
  // Sube una foto y devuelve su dirección (o el motivo por el que no se pudo).
  async function subirUna(file: File): Promise<{ url: string } | { error: string }> {
    try {
      const res = await subirMedia(file);
      if (!res.ok) return { error: res.error };
      if (res.kind !== "imagen") return { error: "Sube una imagen (JPG, PNG o WebP)." };
      return { url: res.url };
    } catch {
      return { error: "No se pudo subir la foto." };
    }
  }
  // Cambia la foto de una diapositiva.
  async function cambiarFoto(file: File, id: string) {
    setMsg("");
    setSubiendo(id);
    const r = await subirUna(file);
    setSubiendo(null);
    if ("error" in r) return setMsg(r.error);
    cambiar(id, { imagen: r.url });
  }
  // Agrega varias fotos de una vez, hasta llenar los cupos libres; avisa si alguna no cupo.
  async function agregar(files: File[]) {
    setMsg("");
    if (lleno) return setMsg(`Ya hay ${max} fotos, el máximo. Elimina alguna para subir otra.`);
    const tomar = files.slice(0, libres);
    setSubiendo("nueva");
    const nuevas: Diapositiva[] = [];
    const errores: string[] = [];
    for (const f of tomar) {
      const r = await subirUna(f);
      if ("error" in r) errores.push(r.error);
      else nuevas.push({ id: nuevoId(), imagen: r.url, etiqueta: "", titulo: "", texto: "", enlace: "", nuevaPestana: false });
    }
    setSubiendo(null);
    if (nuevas.length) onChange([...lista, ...nuevas]);
    const avisos = [
      files.length > tomar.length ? `${files.length - tomar.length} foto(s) no cupieron: el máximo es ${max}.` : "",
      errores[0] ? `${errores.length} no se pudo(pudieron) subir: ${errores[0]}` : "",
    ].filter(Boolean);
    if (avisos.length) setMsg(avisos.join(" "));
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      {/* Contador con barra: se ve de un vistazo cuántas fotos hay y cuántas caben. */}
      <div>
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-semibold">{lista.length === 0 ? "Aún no hay fotos" : `${lista.length} ${lista.length === 1 ? "foto" : "fotos"} en el carrusel`}</span>
          <span className={lleno ? "font-semibold text-[#b45309]" : "text-[var(--fg-muted)]"}>{lista.length} de {max}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div className={`h-full rounded-full transition-all ${lleno ? "bg-[#d97706]" : "bg-[var(--accent)]"}`} style={{ width: `${(lista.length / max) * 100}%` }} />
        </div>
      </div>

      {lista.length > 0 && (
        <ol className="flex flex-col gap-2">
          {lista.map((d, i) => {
            const abierto = editando === d.id;
            return (
              <li key={d.id} className={`overflow-hidden rounded-xl border ${abierto ? "border-[var(--accent)]" : "border-[var(--border)]"}`}>
                <div className="flex items-center gap-3 p-2">
                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                    <Image src={d.imagen} alt="" fill unoptimized className="object-cover" />
                    <span className="absolute left-1 top-1 grid size-5 place-items-center rounded-full bg-black/70 text-[11px] font-bold text-white">{i + 1}</span>
                    {subiendo === d.id && (
                      <span className="absolute inset-0 grid place-items-center bg-black/50 text-white"><Loader2 size={16} className="animate-spin" /></span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-xs font-semibold ${d.titulo ? "" : "text-[var(--fg-muted)] italic"}`}>{d.titulo || "Sin título"}</p>
                    <p className="truncate text-[11px] text-[var(--fg-muted)]">{d.enlace ? `Enlaza a ${d.enlace}` : "Sin enlace"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 border-t border-[var(--border)] bg-[var(--surface-2)]/50 px-2 py-1.5">
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir la foto ${i + 1}`} className="grid size-8 place-items-center rounded-md hover:bg-[var(--surface-2)] disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === lista.length - 1} aria-label={`Bajar la foto ${i + 1}`} className="grid size-8 place-items-center rounded-md hover:bg-[var(--surface-2)] disabled:opacity-30"><ArrowDown size={14} /></button>
                  <button type="button" onClick={() => setEditando(abierto ? null : d.id)} aria-expanded={abierto} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium hover:bg-[var(--surface-2)]">
                    <Pencil size={13} /> {abierto ? "Cerrar" : "Editar"}
                  </button>
                  <button type="button" onClick={() => { onChange(lista.filter((x) => x.id !== d.id)); if (abierto) setEditando(null); setMsg(""); }} className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-red-700 hover:bg-red-600/10">
                    <Trash2 size={13} /> Eliminar
                  </button>
                </div>
                {abierto && (
                  <div className="flex flex-col gap-1.5 border-t border-[var(--border)] p-2.5">
                    <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:border-[var(--accent)]">
                      <ImagePlus size={13} /> Cambiar foto
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) cambiarFoto(f, d.id); }} />
                    </label>
                    <input key={`e-${d.etiqueta}`} defaultValue={d.etiqueta} onBlur={(e) => cambiar(d.id, { etiqueta: e.target.value })} maxLength={40} placeholder="Etiqueta pequeña (p. ej. Evento)" className="lx-input !py-1.5 !text-xs" />
                    <input key={`t-${d.titulo}`} defaultValue={d.titulo} onBlur={(e) => cambiar(d.id, { titulo: e.target.value })} maxLength={120} placeholder="Título" className="lx-input !py-1.5 !text-xs" />
                    <textarea key={`x-${d.texto}`} defaultValue={d.texto} onBlur={(e) => cambiar(d.id, { texto: e.target.value })} maxLength={300} rows={2} placeholder="Texto (sale debajo del título)" className="lx-input resize-y !py-1.5 !text-xs" />
                    <input key={`l-${d.enlace}`} defaultValue={d.enlace} onBlur={(e) => cambiar(d.id, { enlace: e.target.value })} placeholder="Enlace: https://… o /seccion/nota (vacío = sin enlace)" className="lx-input !py-1.5 !text-xs" />
                    <Casilla etiqueta="Abrir el enlace en otra pestaña" valor={d.nuevaPestana} onChange={(nuevaPestana) => cambiar(d.id, { nuevaPestana })} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {lleno ? (
        <p role="status" className="rounded-lg border border-[#d97706]/40 bg-[#d97706]/10 px-3 py-2 text-xs text-[#92400e]">
          Llegaste al máximo de {max} fotos. Para subir otra, elimina una con el botón «Eliminar» de su tarjeta.
        </p>
      ) : (
        <label className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-[var(--border-strong)] px-3 py-4 text-center transition hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 ${subiendo === "nueva" ? "pointer-events-none opacity-60" : ""}`}>
          {subiendo === "nueva" ? <Loader2 size={20} className="animate-spin text-[var(--accent)]" /> : <ImagePlus size={20} className="text-[var(--accent)]" />}
          <span className="text-xs font-semibold text-[var(--accent)]">{subiendo === "nueva" ? "Subiendo…" : "Subir fotos"}</span>
          <span className="text-[11px] text-[var(--fg-muted)]">Puedes elegir varias. Caben {libres} más.</span>
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) agregar(fs); }} />
        </label>
      )}
      {msg && <p role="alert" className="text-xs text-red-700">{msg}</p>}

      {lista.length > 1 && (
        confirmarTodas ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span>¿Eliminar las {lista.length} fotos?</span>
            <button type="button" onClick={() => { onChange([]); setConfirmarTodas(false); setEditando(null); setMsg(""); }} className="rounded-md bg-red-700 px-2.5 py-1 font-semibold text-white">Sí, eliminar todas</button>
            <button type="button" onClick={() => setConfirmarTodas(false)} className="rounded-md border border-[var(--border)] px-2.5 py-1 font-medium">Cancelar</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmarTodas(true)} className="w-fit text-xs font-medium text-red-700 hover:underline">Eliminar todas las fotos</button>
        )
      )}
      <p className="text-[11px] text-[var(--fg-muted)]">Una foto enlaza a una nota si pegas su dirección en «Editar» (p. ej. /articulo/mi-nota). Los cambios salen al publicar la portada.</p>
    </div>
  );
}

/**
 * Más carruseles, además del principal: cada uno con su propia fuente, estilo y lugar de la portada. Se pueden añadir hasta
 * `CARRUSEL_MAX_EXTRA`, abrir uno para editarlo y quitarlo cuando ya no haga falta.
 */
export function CarruselesExtra({
  value,
  onChange,
  secciones,
}: {
  value: CarruselConfig[] | undefined;
  onChange: (next: Required<CarruselConfig>[]) => void;
  secciones: { slug: string; name: string }[];
}) {
  const lista = sanitizeCarruseles(value);
  const [abierto, setAbierto] = useState<number | null>(null);
  const cambiar = (i: number, c: Required<CarruselConfig>) => onChange(lista.map((x, j) => (j === i ? c : x)));
  const quitar = (i: number) => {
    onChange(lista.filter((_, j) => j !== i));
    setAbierto(null);
  };
  const añadir = () => {
    onChange([...lista, sanitizeCarrusel({ activo: true, posicion: "abajo", titulo: `Carrusel ${lista.length + 2}`, fuente: "recientes" })]);
    setAbierto(lista.length);
  };
  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      <h4 className="text-sm font-semibold">Más carruseles</h4>
      <p className="mt-1 text-xs text-[var(--fg-muted)]">Añade otros carruseles y ponlos donde quieras: bajo el cintillo, tras «En vivo», tras la nota principal o al final.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {lista.map((c, i) => (
          <li key={i} className="rounded-lg border border-[var(--border)]">
            <div className="flex items-center gap-2 p-2">
              <button type="button" onClick={() => setAbierto(abierto === i ? null : i)} className="min-w-0 flex-1 text-left" aria-expanded={abierto === i}>
                <span className="block truncate text-sm font-medium">{c.titulo || `Carrusel ${i + 2}`}{c.activo ? "" : " · apagado"}</span>
                <span className="block truncate text-xs text-[var(--fg-muted)]">{resumenCarrusel(c)}</span>
              </button>
              <button type="button" onClick={() => quitar(i)} aria-label={`Quitar el carrusel ${i + 2}`} className="rounded-md p-2 text-[var(--danger)] hover:bg-[var(--surface-2)]">
                <Trash2 size={15} />
              </button>
            </div>
            {abierto === i && (
              <div className="border-t border-[var(--border)] p-2">
                <CarruselEditor value={c} onChange={(n) => cambiar(i, n)} secciones={secciones} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {lista.length < CARRUSEL_MAX_EXTRA && (
        <button type="button" onClick={añadir} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]">
          <Plus size={14} /> Añadir otro carrusel
        </button>
      )}
    </div>
  );
}

// Videos de YouTube del carrusel de TV: se pega el enlace, la foto sale sola (la del propio video) y se escribe el título. «Traer los de la
// Portada del inicio» copia los que hoy están en Páginas, para no volver a escribirlos.
const idYoutube = (u: string) => /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/.exec(u)?.[1] ?? null;
let videosYaTraidos = false;
function Videos({ lista, onChange }: { lista: Diapositiva[]; onChange: (d: Diapositiva[]) => void }) {
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [trayendo, setTrayendo] = useState(false);
  const lleno = lista.length >= CARRUSEL_MAX_DIAPOSITIVAS;
  const mover = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    const c = lista.slice();
    [c[i], c[j]] = [c[j], c[i]];
    onChange(c);
  };
  function agregar() {
    const id = idYoutube(url.trim());
    if (!id) return setMsg("Pega el enlace de un video de YouTube (youtube.com/watch?v=… o youtu.be/…).");
    if (lleno) return setMsg(`Ya hay ${CARRUSEL_MAX_DIAPOSITIVAS} videos, el máximo.`);
    onChange([...lista, { id: nuevoId(), imagen: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, etiqueta: "", titulo: "", texto: "", enlace: `https://www.youtube.com/watch?v=${id}`, nuevaPestana: true }]);
    setUrl("");
    setMsg("");
  }
  // La primera vez que se abre el editor sin videos propios, se cargan solos los que hoy salen en el carrusel de TV (los de la Portada del
  // inicio), para que el carrusel que se ve en el sitio ya esté aquí y se pueda ajustar; se guardan al «Publicar cambios».
  useEffect(() => {
    if (lista.length === 0 && !videosYaTraidos) {
      videosYaTraidos = true;
      void traer(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function traer(silencioso = false) {
    setTrayendo(true);
    setMsg("");
    try {
      const v = await videosDelInicio();
      if (!v.length) { if (!silencioso) setMsg("La página «Portada del inicio» no tiene videos de YouTube."); }
      else onChange(v.map((x) => ({ id: nuevoId(), imagen: x.imagen, etiqueta: "", titulo: x.titulo, texto: "", enlace: x.enlace, nuevaPestana: true })));
    } catch {
      setMsg("No se pudieron leer los videos de la Portada del inicio.");
    }
    setTrayendo(false);
  }
  return (
    <div className="flex flex-col gap-3 pt-2">
      <p className="text-xs text-[var(--fg-muted)]">Si hay videos aquí, salen en el carrusel de TV de la portada en lugar del que está en Páginas.</p>
      <div className="flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }} placeholder="https://www.youtube.com/watch?v=…" className="lx-input min-w-0 flex-1 !py-1.5 !text-xs" />
        <button type="button" onClick={agregar} disabled={lleno} className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--border)] px-2.5 text-xs font-semibold hover:border-[var(--accent)] disabled:opacity-40"><Plus size={13} /> Agregar</button>
      </div>
      {lista.length === 0 && (
        <button type="button" onClick={() => traer()} disabled={trayendo} className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 text-xs font-medium hover:border-[var(--accent)] disabled:opacity-50">
          {trayendo && <Loader2 size={13} className="animate-spin" />} Traer los videos de la Portada del inicio
        </button>
      )}
      {msg && <p role="status" className="text-xs text-[#b45309]">{msg}</p>}
      <ol className="flex flex-col gap-2">
        {lista.map((d, i) => (
          <li key={d.id} className="overflow-hidden rounded-xl border border-[var(--border)]">
            <div className="flex items-center gap-3 p-2">
              <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                <Image src={d.imagen} alt="" fill unoptimized className="object-cover" />
                <span className="absolute left-1 top-1 grid size-5 place-items-center rounded-full bg-black/70 text-[11px] font-bold text-white">{i + 1}</span>
              </div>
              <input key={`t-${d.titulo}`} defaultValue={d.titulo} onBlur={(e) => onChange(lista.map((x) => (x.id === d.id ? { ...x, titulo: e.target.value } : x)))} maxLength={120} placeholder="Título del video" className="lx-input min-w-0 flex-1 !py-1.5 !text-xs" />
            </div>
            <div className="flex items-center gap-1 border-t border-[var(--border)] bg-[var(--surface-2)]/50 px-2 py-1.5">
              <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir el video ${i + 1}`} className="grid size-8 place-items-center rounded-md hover:bg-[var(--surface-2)] disabled:opacity-30"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => mover(i, 1)} disabled={i === lista.length - 1} aria-label={`Bajar el video ${i + 1}`} className="grid size-8 place-items-center rounded-md hover:bg-[var(--surface-2)] disabled:opacity-30"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => onChange(lista.filter((x) => x.id !== d.id))} className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-red-700 hover:bg-red-600/10"><Trash2 size={13} /> Eliminar</button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Interruptor propio de un carrusel (el general de arriba apaga todos).
function Interruptor({ activo, nombre, onChange }: { activo: boolean; nombre: string; onChange: (v: boolean) => void }) {
  return (
    <label className={`mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs transition ${activo ? "border-[var(--accent)] bg-[var(--accent)]/8" : "border-[var(--border-strong)]"}`}>
      <span className="font-semibold">{activo ? `${nombre} encendido` : `${nombre} apagado`}</span>
      <input type="checkbox" role="switch" checked={activo} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className={`relative h-5 w-9 shrink-0 rounded-full transition ${activo ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"} peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--accent)]`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${activo ? "left-[1.125rem]" : "left-0.5"}`} />
      </span>
    </label>
  );
}
