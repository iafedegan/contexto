"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Link2, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import {
  agregarEnlaces,
  agregarTexto,
  alternarEstilo,
  borrarMiEstilo,
  generarDiagnostico,
  quitarFuente,
  type EstiloResultado,
} from "@/app/panel/(app)/configuracion/estilo-actions";
import { ESTILO_LIMITES, type EstiloVista } from "@/lib/ai/estilo-tipos";

const nf = new Intl.NumberFormat("es-CO");
const fecha = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" }).format(new Date(iso));

/**
 * «Mi estilo de escritura»: la persona carga muestras de lo que ha escrito (enlaces a sus notas, texto pegado o un archivo) y la IA
 * le entrega un diagnóstico de su tono y su forma de escribir. Con el diagnóstico activo, la IA redacta con ese estilo cuando
 * ella le pide un borrador.
 */
export function EstiloEscritura({ inicial, escritorId, nombre, onCambio }: { inicial: EstiloVista; escritorId?: string; nombre?: string; onCambio?: (e: EstiloVista) => void }) {
  // Con `escritorId` (solo administradores) se le enseña a OTRO escritor; sin él, a la propia persona.
  const de = nombre ?? "";
  const ajeno = !!escritorId;
  const [estado, setEstadoLocal] = useState(inicial);
  const setEstado = (e: EstiloVista) => { setEstadoLocal(e); onCambio?.(e); };
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enlaces, setEnlaces] = useState("");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [pendiente, empezar] = useTransition();
  const [haciendo, setHaciendo] = useState("");
  const archivo = useRef<HTMLInputElement>(null);

  // Ejecuta una acción del servidor y pinta su resultado.
  function correr(que: string, accion: () => Promise<EstiloResultado>, despues?: (r: EstiloResultado) => void) {
    setAviso(null);
    setHaciendo(que);
    empezar(async () => {
      try {
        const r = await accion();
        if (r.estado) setEstado(r.estado);
        setAviso({ ok: r.ok, texto: r.message });
        despues?.(r);
      } catch {
        setAviso({ ok: false, texto: "No se pudo completar. Inténtalo de nuevo." });
      } finally {
        setHaciendo("");
      }
    });
  }

  // Lee un archivo de texto (.txt, .md, .html) y lo carga como muestra.
  async function cargarArchivo(f: File | undefined) {
    if (!f) return;
    if (f.size > 2_000_000) return setAviso({ ok: false, texto: "El archivo es muy grande (máximo 2 MB)." });
    const t = await f.text();
    correr("texto", () => agregarTexto(f.name.replace(/\.[a-z0-9]+$/i, ""), t, escritorId));
    if (archivo.current) archivo.current.value = "";
  }

  const palabras = estado.fuentes.reduce((s, f) => s + f.palabras, 0);
  const listo = estado.fuentes.length >= ESTILO_LIMITES.minimoMuestras && palabras >= ESTILO_LIMITES.minimoPalabras;
  const d = estado.diagnostico;
  const caja = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-4";

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-3xl text-sm leading-relaxed text-[var(--fg-muted)]">
        {ajeno ? (
          <>Enséñale a la IA cómo escribe <strong>{de}</strong>. Carga <strong>al menos {ESTILO_LIMITES.minimoMuestras} notas suyas</strong> (por enlace, pegando el texto o subiendo un archivo) y te entregará un diagnóstico de su tono y su forma de escribir. Después podrás elegir a {de} como escritor del consejo de redacción: la IA redactará con su estilo, sin cambiar las reglas de veracidad y de fuentes. Solo los administradores ven estas muestras.</>
        ) : (
          <>Enséñale a la IA cómo escribes. Carga <strong>al menos {ESTILO_LIMITES.minimoMuestras} notas tuyas</strong> (por enlace, pegando el texto o subiendo un archivo) y te entregará un diagnóstico de tu tono y tu forma de escribir. Con el estilo activo, cuando le pidas un borrador, la IA lo redactará como tú, sin cambiar las reglas de veracidad y de fuentes. Solo tú ves tus muestras.</>
        )}
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---------------------------------------------------------- Muestras */}
        <div className="flex flex-col gap-4">
          <div className={caja}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{ajeno ? `Muestras de ${de}` : "Tus muestras"}</h3>
              <span className={`text-xs tabular-nums ${listo ? "font-semibold text-[var(--accent-2)]" : "text-[var(--fg-muted)]"}`}>
                {estado.fuentes.length} de {ESTILO_LIMITES.muestras} · {nf.format(palabras)} palabras {listo ? "✓" : `(mínimo ${ESTILO_LIMITES.minimoMuestras} notas y ~${nf.format(ESTILO_LIMITES.minimoPalabras)} palabras)`}
              </span>
            </div>
            {estado.fuentes.length === 0 ? (
              <p className="text-sm text-[var(--fg-muted)]">Todavía no hay muestras. Añade enlaces a tus notas o pega algunos textos.</p>
            ) : (
              <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
                {estado.fuentes.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <span className="shrink-0 text-[var(--accent)]">{f.tipo === "enlace" ? <Link2 size={14} /> : <FileText size={14} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" title={f.titulo}>{f.titulo}</span>
                      <span className="block truncate text-xs text-[var(--fg-muted)]">{nf.format(f.palabras)} palabras{f.url ? ` · ${new URL(f.url).hostname}` : ""}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Quitar ${f.titulo}`}
                      disabled={pendiente}
                      onClick={() => correr("quitar", () => quitarFuente(f.id, escritorId))}
                      className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={caja}>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">Enlaces a tus notas</label>
            <textarea
              value={enlaces}
              onChange={(e) => setEnlaces(e.target.value)}
              rows={3}
              placeholder={"https://www.contextoganadero.com/regiones/mi-nota…\n(uno por línea, hasta 5 a la vez)"}
              className="lx-input resize-y text-sm"
            />
            <button
              type="button"
              disabled={pendiente || !enlaces.trim()}
              onClick={() => correr("enlaces", () => agregarEnlaces(enlaces, escritorId), (r) => r.ok && setEnlaces(""))}
              className="lx-btn mt-2"
            >
              {haciendo === "enlaces" ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
              {haciendo === "enlaces" ? "Leyendo…" : "Añadir enlaces"}
            </button>
          </div>

          <div className={caja}>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">Pegar un texto o subir un archivo</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la nota (opcional)" className="lx-input mb-2 text-sm" />
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} placeholder="Pega aquí una nota completa que hayas escrito…" className="lx-input resize-y text-sm" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pendiente || !texto.trim()}
                onClick={() => correr("texto", () => agregarTexto(titulo, texto, escritorId), (r) => { if (r.ok) { setTexto(""); setTitulo(""); } })}
                className="lx-btn"
              >
                {haciendo === "texto" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                Añadir texto
              </button>
              <button type="button" disabled={pendiente} onClick={() => archivo.current?.click()} className="lx-btn">
                <Upload size={15} /> Subir archivo
              </button>
              <input ref={archivo} type="file" accept=".txt,.md,.html,.htm,text/plain,text/markdown,text/html" className="hidden" onChange={(e) => void cargarArchivo(e.target.files?.[0])} />
              <span className="text-xs text-[var(--fg-muted)]">.txt, .md o .html (máx. 2 MB)</span>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------- Diagnóstico */}
        <div className="flex flex-col gap-4">
          <div className={caja}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{ajeno ? `Diagnóstico del estilo de ${de}` : "Diagnóstico de tu estilo"}</h3>
                <p className="text-xs text-[var(--fg-muted)]">{d ? `Generado el ${fecha(d.generadoEn)} con ${d.muestras} notas y ${nf.format(d.palabras)} palabras.` : "Aún no se ha generado."}</p>
              </div>
              <button type="button" disabled={pendiente || !listo} onClick={() => correr("diagnostico", () => generarDiagnostico(escritorId))} className="lx-btn">
                {haciendo === "diagnostico" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {haciendo === "diagnostico" ? "Analizando tu estilo…" : d ? "Volver a generar" : "Generar diagnóstico"}
              </button>
            </div>
            {!listo && <p className="mt-2 text-xs text-[var(--fg-muted)]">Carga más muestras para poder generar el diagnóstico.</p>}
          </div>

          {d && (
            <div className={`${caja} flex flex-col gap-4`}>
              <p className="text-sm leading-relaxed">{d.resumen}</p>
              <div className="flex flex-wrap gap-1.5">
                {d.tono.map((t) => (
                  <span key={t} className="rounded-full bg-[var(--accent)]/12 px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">{t}</span>
                ))}
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {([
                  ["Voz", d.voz], ["Estructura", d.estructura], ["Ritmo", d.ritmo], ["Vocabulario", d.vocabulario], ["Cómo abres", d.aperturas], ["Cómo cierras", d.cierres],
                ] as const).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">{k}</dt>
                    <dd className="mt-0.5 leading-snug">{v}</dd>
                  </div>
                ))}
              </dl>
              {d.fortalezas.length > 0 && (
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">Tus fortalezas</p>
                  <ul className="mt-1 list-disc pl-5 text-sm leading-snug">{d.fortalezas.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              )}
              {d.evitar.length > 0 && (
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">Lo que la IA evitará</p>
                  <ul className="mt-1 list-disc pl-5 text-sm leading-snug">{d.evitar.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              )}
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">{ajeno ? `Reglas que seguirá la IA al escribir como ${de}` : "Reglas que seguirá la IA al escribir por ti"}</p>
                <ol className="mt-1 list-decimal pl-5 text-sm leading-snug">{d.reglas.map((x) => <li key={x}>{x}</li>)}</ol>
              </div>
              <label className="flex cursor-pointer items-center gap-2 border-t border-[var(--border)] pt-3 text-sm font-medium">
                <input type="checkbox" checked={estado.activo} disabled={pendiente} onChange={(e) => correr("activo", () => alternarEstilo(e.target.checked, escritorId))} className="size-4 accent-[var(--accent)]" />
                {ajeno ? `Usar el estilo de ${de} cuando se elija` : "Usar mi estilo cuando la IA redacte por mí"}
              </label>
            </div>
          )}

          {(estado.fuentes.length > 0 || d) && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => { if (window.confirm(ajeno ? `¿Borrar las muestras y el diagnóstico de ${de}?` : "¿Borrar todas tus muestras y tu diagnóstico?")) correr("borrar", () => borrarMiEstilo(escritorId)); }}
              className="self-start text-xs font-medium text-[var(--fg-muted)] underline-offset-2 transition hover:text-[var(--danger)] hover:underline"
            >
              Borrar mis muestras y mi diagnóstico
            </button>
          )}
        </div>
      </div>

      {aviso && (
        <p role="status" className={`rounded-[var(--radius)] border px-3 py-2 text-sm ${aviso.ok ? "border-[var(--accent-2)]/40 text-[var(--accent-2)]" : "border-[var(--danger)]/40 text-[var(--danger)]"}`}>
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
