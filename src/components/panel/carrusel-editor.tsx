"use client";

import type { ReactNode } from "react";
import { sanitizeCarrusel, type CarruselConfig } from "@/lib/carrusel";

/**
 * Carrusel de notas de la portada, dentro del editor: de dónde salen las notas, cuántas tarjetas se ven en cada pantalla, el estilo
 * de cada tarjeta, el paso automático, la transición, las flechas, los indicadores y los colores. Los cambios se ven al instante en el
 * lienzo y se publican con «Publicar cambios», como el resto del diseño. Vale para todas las plantillas.
 */
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
    <div className="flex flex-col gap-4 text-sm">
      <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2">
        <span className="font-semibold">{v.activo ? "Carrusel activado" : "Carrusel apagado"}</span>
        <input type="checkbox" checked={v.activo} onChange={(e) => set({ activo: e.target.checked })} className="size-4 accent-[var(--accent)]" />
      </label>

      <fieldset disabled={!v.activo} className="flex flex-col gap-4 disabled:opacity-50">
        <Grupo titulo="Título y lugar">
          <input value={v.titulo} onChange={(e) => set({ titulo: e.target.value })} maxLength={60} placeholder="Título sobre el carrusel (vacío = sin título)" className="lx-input !py-1.5 !text-xs" />
          <Opciones
            etiqueta="Dónde va en la portada"
            valor={v.posicion}
            opciones={[
              ["arriba", "Arriba, bajo el cintillo"],
              ["tras-principal", "Tras la nota principal"],
              ["abajo", "Al final, antes del pie"],
            ]}
            onChange={(posicion) => set({ posicion })}
          />
        </Grupo>

        <Grupo titulo="Notas">
          <Opciones
            etiqueta="De dónde salen"
            valor={v.fuente}
            opciones={[
              ["portada", "Como la portada"],
              ["recientes", "Las más recientes"],
              ["masleidas", "Las más leídas"],
              ["seccion", "De una sección"],
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
          <Deslizador etiqueta="Cuántas notas" valor={v.cantidad} min={3} max={20} texto={String(v.cantidad)} onChange={(cantidad) => set({ cantidad })} />
          <Casilla etiqueta="Solo notas que tengan foto" valor={v.soloConFoto} onChange={(soloConFoto) => set({ soloConFoto })} />
        </Grupo>

        <Grupo titulo="Cuántas tarjetas se ven a la vez">
          <Deslizador etiqueta="En computador" valor={v.visiblesEscritorio} min={1} max={5} texto={String(v.visiblesEscritorio)} onChange={(visiblesEscritorio) => set({ visiblesEscritorio })} />
          <Deslizador etiqueta="En tableta" valor={v.visiblesTableta} min={1} max={3} texto={String(v.visiblesTableta)} onChange={(visiblesTableta) => set({ visiblesTableta })} />
          <Deslizador etiqueta="En celular" valor={v.visiblesCelular} min={1} max={2} texto={String(v.visiblesCelular)} onChange={(visiblesCelular) => set({ visiblesCelular })} />
          <Deslizador etiqueta="Separación entre tarjetas" valor={v.separacion} min={0} max={40} texto={`${v.separacion} px`} onChange={(separacion) => set({ separacion })} />
        </Grupo>

        <Grupo titulo="Tarjeta">
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
      </fieldset>
    </div>
  );
}

// Un grupo de controles con título.
function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{titulo}</p>
      {children}
    </div>
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
