"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { guardarDisenoBoletin } from "../actions";
import { DEFAULT_NEWSLETTER_DESIGN, DEFAULT_NEWSLETTER_SETTINGS, type NewsletterDesign } from "@/lib/newsletter/types";

/** Diseño editable del correo: el diseño y el color de acento (que vive en los ajustes del boletín). */
export type DisenoEditable = NewsletterDesign & { acento: string };

/** Diseño por defecto, para «Restablecer». */
export const DISENO_POR_DEFECTO: DisenoEditable = { ...DEFAULT_NEWSLETTER_DESIGN, acento: DEFAULT_NEWSLETTER_SETTINGS.accentColor };

// Paletas listas para elegir con un clic.
const PALETAS: { nombre: string; v: Pick<DisenoEditable, "colorPagina" | "colorTarjeta" | "colorTitulos" | "colorTexto" | "acento"> }[] = [
  { nombre: "Clásico", v: { colorPagina: "#f3efe7", colorTarjeta: "#ffffff", colorTitulos: "#1c1712", colorTexto: "#3a342e", acento: "#8a2b1f" } },
  { nombre: "Verde campo", v: { colorPagina: "#eaf1e4", colorTarjeta: "#ffffff", colorTitulos: "#14301c", colorTexto: "#34423a", acento: "#2e8b3f" } },
  { nombre: "Tinta", v: { colorPagina: "#e9ecf1", colorTarjeta: "#ffffff", colorTitulos: "#101828", colorTexto: "#344054", acento: "#1f3f78" } },
  { nombre: "Cálido", v: { colorPagina: "#fbf3e4", colorTarjeta: "#fffdf8", colorTitulos: "#3b2412", colorTexto: "#5a4636", acento: "#c2410c" } },
];

// Maquetaciones: cómo se ven las notas. El dibujito es un esquema de bloques.
const MAQUETAS: { id: DisenoEditable["plantilla"]; nombre: string; ayuda: string }[] = [
  { id: "clasica", nombre: "Clásica", ayuda: "Una destacada y una lista con miniatura" },
  { id: "revista", nombre: "Revista", ayuda: "Todas con foto grande" },
  { id: "compacta", nombre: "Compacta", ayuda: "Miniaturas pequeñas, más notas a la vista" },
  { id: "minima", nombre: "Mínima", ayuda: "Una destacada y solo titulares" },
];

// Esquema en bloques de cada maquetación.
function Esquema({ id }: { id: DisenoEditable["plantilla"] }) {
  const b = "rounded-[2px] bg-current opacity-30";
  const t = "rounded-[2px] bg-current opacity-60";
  if (id === "revista") return (<div className="flex w-full flex-col gap-1"><div className={`${b} h-5`} /><div className={`${t} h-1`} /><div className={`${b} h-5`} /><div className={`${t} h-1`} /></div>);
  if (id === "compacta") return (<div className="flex w-full flex-col gap-1"><div className={`${b} h-4`} /><div className="flex gap-1"><div className={`${b} size-3`} /><div className={`${t} mt-1 h-1 flex-1`} /></div><div className="flex gap-1"><div className={`${b} size-3`} /><div className={`${t} mt-1 h-1 flex-1`} /></div></div>);
  if (id === "minima") return (<div className="flex w-full flex-col gap-1"><div className={`${b} h-4`} /><div className={`${t} h-1`} /><div className={`${t} h-1 w-3/4`} /><div className={`${t} h-1 w-2/3`} /></div>);
  return (<div className="flex w-full flex-col gap-1"><div className={`${b} h-4`} /><div className="flex gap-1"><div className={`${b} h-3 w-5`} /><div className={`${t} mt-1 h-1 flex-1`} /></div><div className="flex gap-1"><div className={`${b} h-3 w-5`} /><div className={`${t} mt-1 h-1 flex-1`} /></div></div>);
}

// Grupo de botones excluyentes (un valor entre pocos).
function Opciones<T extends string | number>({ valor, opciones, alElegir, etiqueta }: { valor: T; opciones: readonly { v: T; t: string }[]; alElegir: (v: T) => void; etiqueta: string }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex flex-wrap gap-1 rounded-full bg-[var(--surface-2)] p-1">
      {opciones.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={valor === o.v}
          onClick={() => alElegir(o.v)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${valor === o.v ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}

// Interruptor con etiqueta.
function Interruptor({ activo, alCambiar, texto }: { activo: boolean; alCambiar: (v: boolean) => void; texto: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
      <span>{texto}</span>
      <input type="checkbox" role="switch" checked={activo} onChange={(e) => alCambiar(e.target.checked)} className="size-4 accent-[var(--accent)]" />
    </label>
  );
}

const Grupo = ({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-2.5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3.5">
    <div>
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {ayuda && <p className="text-xs text-[var(--fg-muted)]">{ayuda}</p>}
    </div>
    {children}
  </section>
);

/**
 * Panel de diseño del boletín: maquetación, paletas y colores, tipografía, formas, qué se muestra y textos. Cada cambio se ve al
 * instante en la vista previa; «Guardar diseño» lo deja para todas las ediciones.
 */
export function DisenoBoletin({ valor, alCambiar, puedeEditar }: { valor: DisenoEditable; alCambiar: (v: DisenoEditable) => void; puedeEditar: boolean }) {
  const [pendiente, empezar] = useTransition();
  const [aviso, setAviso] = useState("");
  const poner = <K extends keyof DisenoEditable>(k: K, v: DisenoEditable[K]) => alCambiar({ ...valor, [k]: v });
  const color = (k: "colorPagina" | "colorTarjeta" | "colorTitulos" | "colorTexto" | "acento", etiqueta: string) => (
    <label className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm">
      <span>{etiqueta}</span>
      <span className="flex items-center gap-2">
        <span className="lx-mono text-[0.7rem] uppercase text-[var(--fg-muted)]">{valor[k]}</span>
        <input type="color" aria-label={etiqueta} value={valor[k]} onChange={(e) => poner(k, e.target.value)} className="size-7 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0" />
      </span>
    </label>
  );

  const guardar = () =>
    empezar(async () => {
      const r = await guardarDisenoBoletin({ design: valor, acento: valor.acento });
      setAviso(r.message);
    });

  return (
    <div className={`flex flex-col gap-3 ${puedeEditar ? "" : "pointer-events-none opacity-60"}`}>
      <Grupo titulo="Maquetación de las notas" ayuda="Cómo se ordenan las notas dentro del correo.">
        <div className="grid grid-cols-2 gap-2">
          {MAQUETAS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={valor.plantilla === m.id}
              onClick={() => poner("plantilla", m.id)}
              className={`flex flex-col gap-2 rounded-[var(--radius)] border p-2.5 text-left transition ${valor.plantilla === m.id ? "border-[var(--accent)] bg-[var(--accent)]/8 text-[var(--accent)]" : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]"}`}
            >
              <Esquema id={m.id} />
              <span>
                <span className="block text-sm font-semibold text-[var(--fg)]">{m.nombre}</span>
                <span className="block text-[0.7rem] leading-tight">{m.ayuda}</span>
              </span>
            </button>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Colores" ayuda="Elige una paleta o ajusta cada color.">
        <div className="flex flex-wrap gap-1.5">
          {PALETAS.map((p) => (
            <button key={p.nombre} type="button" onClick={() => alCambiar({ ...valor, ...p.v })} className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-semibold transition hover:border-[var(--accent)]">
              <span className="flex -space-x-1" aria-hidden>
                {[p.v.colorPagina, p.v.acento, p.v.colorTitulos].map((c, i) => <span key={i} className="size-3.5 rounded-full border border-black/10" style={{ background: c }} />)}
              </span>
              {p.nombre}
            </button>
          ))}
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {color("acento", "Acento (botones y rótulos)")}
          {color("colorTitulos", "Titulares")}
          {color("colorTexto", "Texto")}
          {color("colorTarjeta", "Fondo del correo")}
          {color("colorPagina", "Fondo de la página")}
        </div>
      </Grupo>

      <Grupo titulo="Tipografía y formas">
        <div className="flex flex-col gap-2.5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><span>Titulares</span><Opciones etiqueta="Tipografía" valor={valor.tipografia} alElegir={(v) => poner("tipografia", v)} opciones={[{ v: "serif", t: "Con serifa" }, { v: "sans", t: "Sin serifa" }, { v: "moderna", t: "Moderna" }]} /></div>
          <div className="flex flex-wrap items-center justify-between gap-2"><span>Esquinas</span><Opciones etiqueta="Esquinas" valor={valor.esquinas} alElegir={(v) => poner("esquinas", v)} opciones={[{ v: "rectas", t: "Rectas" }, { v: "suaves", t: "Suaves" }, { v: "redondas", t: "Redondas" }]} /></div>
          <div className="flex flex-wrap items-center justify-between gap-2"><span>Botones</span><Opciones etiqueta="Forma del botón" valor={valor.boton} alElegir={(v) => poner("boton", v)} opciones={[{ v: "pildora", t: "Píldora" }, { v: "redondo", t: "Redondo" }, { v: "recto", t: "Recto" }]} /></div>
          <div className="flex flex-wrap items-center justify-between gap-2"><span>Franja superior</span><Opciones etiqueta="Grosor de la franja" valor={valor.franja} alElegir={(v) => poner("franja", v)} opciones={[{ v: 0, t: "Sin" }, { v: 4, t: "Fina" }, { v: 8, t: "Media" }, { v: 12, t: "Gruesa" }]} /></div>
          <div className="flex flex-wrap items-center justify-between gap-2"><span>Separadores</span><Opciones etiqueta="Separador" valor={valor.separador} alElegir={(v) => poner("separador", v)} opciones={[{ v: "linea", t: "Línea" }, { v: "punteada", t: "Punteada" }, { v: "ninguno", t: "Ninguno" }]} /></div>
          <div className="flex flex-wrap items-center justify-between gap-2"><span>Cabecera</span><Opciones etiqueta="Alineación de la cabecera" valor={valor.cabecera} alElegir={(v) => poner("cabecera", v)} opciones={[{ v: "centrada", t: "Centrada" }, { v: "izquierda", t: "A la izquierda" }]} /></div>
        </div>
      </Grupo>

      <Grupo titulo="Qué se muestra">
        <div className="grid gap-1.5 sm:grid-cols-2">
          <Interruptor texto="Logo en la cabecera" activo={valor.mostrarLogo} alCambiar={(v) => poner("mostrarLogo", v)} />
          <Interruptor texto="Foto de la destacada" activo={valor.imagenDestacada} alCambiar={(v) => poner("imagenDestacada", v)} />
          <Interruptor texto="Miniaturas de las demás" activo={valor.miniaturas} alCambiar={(v) => poner("miniaturas", v)} />
          <Interruptor texto="Sección de cada nota" activo={valor.mostrarSeccion} alCambiar={(v) => poner("mostrarSeccion", v)} />
          <Interruptor texto="Autor de cada nota" activo={valor.mostrarAutor} alCambiar={(v) => poner("mostrarAutor", v)} />
          <Interruptor texto="Fecha de cada nota" activo={valor.mostrarFecha} alCambiar={(v) => poner("mostrarFecha", v)} />
        </div>
      </Grupo>

      <Grupo titulo="Textos del diseño">
        <label className="flex flex-col gap-1 text-sm">Texto del botón de la destacada
          <input className="lx-input" value={valor.botonTexto} maxLength={40} onChange={(e) => poner("botonTexto", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">Mensaje de cierre <span className="text-xs text-[var(--fg-muted)]">Opcional: sale antes del pie, por ejemplo una despedida o una invitación.</span>
          <textarea rows={3} className="lx-input" value={valor.cierre} maxLength={400} onChange={(e) => poner("cierre", e.target.value)} />
        </label>
      </Grupo>

      <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-[var(--shadow)] backdrop-blur">
        <button type="button" className="lx-btn" disabled={pendiente || !puedeEditar} onClick={guardar}>
          {pendiente ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Guardar diseño
        </button>
        <button type="button" className="lx-btn-ghost" disabled={pendiente || !puedeEditar} onClick={() => alCambiar(DISENO_POR_DEFECTO)}>
          <RotateCcw size={14} /> Restablecer
        </button>
        <span className="text-xs text-[var(--fg-muted)]">{aviso || "Se aplica a todas las ediciones. La vista previa cambia al instante."}</span>
      </div>
    </div>
  );
}
