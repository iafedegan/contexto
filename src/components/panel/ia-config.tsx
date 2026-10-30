"use client";

import { useState, useTransition } from "react";
import { Bot, Clapperboard, ImageIcon, KeyRound, PenLine, RefreshCw, Trash2, TriangleAlert, X, Star, Gauge } from "lucide-react";
import { esModeloDeImagen, esModeloDeTexto, esModeloDeVideo, leerRef, type AiProviderId } from "@/lib/ai-providers";
import type { ConfigIA } from "@/lib/ai-provider";
import type { ResumenUsoIA } from "@/lib/ai-uso";
import { VectorizarAhora } from "@/components/panel/vectorizar-ahora";
import { actualizarCatalogoIA, eliminarClaveIA, guardarClaveIA, guardarModelosIA } from "@/app/panel/(app)/configuracion/actions";

type Pestana = "claves" | "editores" | "vaca" | "imagenes" | "videos" | "limites";

const PESTANAS: { id: Pestana; label: string; icon: React.ReactNode }[] = [
  { id: "claves", label: "Claves", icon: <KeyRound size={14} /> },
  { id: "editores", label: "Editores", icon: <PenLine size={14} /> },
  { id: "vaca", label: "Agente de la vaca", icon: <Bot size={14} /> },
  { id: "imagenes", label: "Imágenes", icon: <ImageIcon size={14} /> },
  { id: "videos", label: "Videos", icon: <Clapperboard size={14} /> },
  { id: "limites", label: "Límites", icon: <Gauge size={14} /> },
];

const NOMBRE_PROVEEDOR: Record<AiProviderId, string> = { google: "Gemini", anthropic: "Claude", openai: "ChatGPT" };

/** Rótulo corto de un modelo «proveedor:modelo» para chips y listas. */
const etiqueta = (ref: string) => {
  const r = leerRef(ref);
  return r ? `${r.model} · ${NOMBRE_PROVEEDOR[r.provider]}` : ref;
};

/**
 * Inteligencia artificial del panel, ordenada por función: claves de cada proveedor, y un modelo propio para los editores (varios, a elegir al
 * crear la nota), el agente de la vaca, las imágenes y los videos. Los límites de gasto van en su propia pestaña.
 */
export function IaConfig({ config, uso = null, canManage, limites }: { config: ConfigIA; uso?: ResumenUsoIA | null; canManage: boolean; limites: React.ReactNode }) {
  const [pestana, setPestana] = useState<Pestana>("claves");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pending, start] = useTransition();

  // Lo que se edita en las pestañas de modelos (se guarda todo junto con un solo botón).
  const [habilitados, setHabilitados] = useState<string[]>(config.editor.habilitados);
  const [predeterminado, setPredeterminado] = useState(config.editor.predeterminado);
  const [asistente, setAsistente] = useState(config.asistente ?? "");
  const [busqueda, setBusqueda] = useState(config.busqueda ?? "");
  const [imagen, setImagen] = useState(config.imagen ?? "");
  const [videoEntender, setVideoEntender] = useState(config.videoEntender ?? "");
  const [videoGenerar, setVideoGenerar] = useState(config.videoGenerar ?? "");
  const [sucio, setSucio] = useState(false);

  const conClave = config.proveedores.filter((p) => p.present);
  const modelosDe = (filtro: (n: string) => boolean, soloGoogle = false) =>
    conClave
      .filter((p) => !soloGoogle || p.id === "google")
      .map((p) => ({ proveedor: p, modelos: p.catalogo.filter(filtro) }))
      .filter((g) => g.modelos.length > 0);
  const hayCatalogo = conClave.some((p) => p.catalogo.length > 0);

  const cambia = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setSucio(true);
    setAviso(null);
  };

  const guardar = () =>
    start(async () => {
      const r = await guardarModelosIA({ editor: { habilitados, predeterminado }, asistente, busqueda, imagen, videoEntender, videoGenerar });
      setAviso({ tipo: r.ok ? "ok" : "error", texto: r.message });
      if (r.ok) setSucio(false);
    });

  const selector = (valor: string, onChange: (v: string) => void, grupos: ReturnType<typeof modelosDe>, vacio: string) => (
    <select value={valor} onChange={(e) => onChange(e.target.value)} disabled={!canManage} className="lx-input lx-mono text-xs">
      <option value="">{vacio}</option>
      {grupos.map((g) => (
        <optgroup key={g.proveedor.id} label={g.proveedor.label}>
          {g.modelos.map((m) => (
            <option key={m} value={`${g.proveedor.id}:${m}`}>
              {m}
            </option>
          ))}
        </optgroup>
      ))}
      {/* Si el modelo elegido ya no está en el catálogo, se conserva a la vista para no perderlo en silencio. */}
      {valor && !grupos.some((g) => g.modelos.some((m) => `${g.proveedor.id}:${m}` === valor)) && <option value={valor}>{etiqueta(valor)} (no listado)</option>}
    </select>
  );

  const pie = (guardable: boolean) =>
    guardable && canManage ? (
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
        <button
          type="button"
          onClick={guardar}
          disabled={pending || !sucio}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Guardando…" : "Guardar modelos"}
        </button>
        {sucio && !pending && <span className="text-xs text-[var(--fg-muted)]">Hay cambios sin guardar en las pestañas de modelos.</span>}
      </div>
    ) : null;

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)]">
      <div className="flex flex-wrap gap-1.5 border-b border-[var(--border)] p-2" role="tablist" aria-label="Inteligencia artificial">
        {PESTANAS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={pestana === t.id}
            onClick={() => setPestana(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${pestana === t.id ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5">
        {!canManage && <p className="mb-4 text-xs text-[var(--fg-muted)]">Solo un administrador puede cambiar estos ajustes.</p>}

        {/* ---------------------------------------------------------------- Claves */}
        {pestana === "claves" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {config.proveedores.map((p) => (
              <ClaveProveedor key={p.id} p={p} uso={uso} canManage={canManage} onAviso={setAviso} />
            ))}
            {canManage && <VectorizarAhora />}
            <p className="text-xs leading-relaxed text-[var(--fg-muted)] lg:col-span-2">
              Cada proveedor guarda su clave cifrada (AES-256-GCM) y nunca se devuelve al navegador. Puedes conectar varios y usar el modelo que mejor
              sirva en cada función (Gemini, Claude y ChatGPT). Si una clave viene del despliegue (variable de entorno), aquí no se puede cambiar.
            </p>
          </div>
        )}

        {/* ---------------------------------------------------------------- Editores */}
        {pestana === "editores" && (
          <div>
            <h3 className="text-sm font-semibold">Modelos para la redacción</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">
              Habilita varios. Quien crea una nota elige con cuál redactar en el paso de generar; el que lleva la estrella es el que sale marcado.
            </p>
            {!hayCatalogo ? (
              <SinModelos />
            ) : (
              <>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {habilitados.map((ref) => (
                    <li key={ref} className={`inline-flex items-center gap-1 rounded-full border py-1 pl-1 pr-2 text-xs ${ref === predeterminado ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border-strong)]"}`}>
                      <button
                        type="button"
                        disabled={!canManage}
                        title={ref === predeterminado ? "Es el predeterminado" : "Marcar como predeterminado"}
                        onClick={() => cambia(setPredeterminado)(ref)}
                        className={`rounded-full p-1 ${ref === predeterminado ? "text-[var(--accent)]" : "text-[var(--fg-muted)] hover:text-[var(--accent)]"}`}
                      >
                        <Star size={13} fill={ref === predeterminado ? "currentColor" : "none"} />
                      </button>
                      <span className="lx-mono">{etiqueta(ref)}</span>
                      {canManage && habilitados.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Quitar ${etiqueta(ref)}`}
                          onClick={() => {
                            const resto = habilitados.filter((x) => x !== ref);
                            cambia(setHabilitados)(resto);
                            if (ref === predeterminado) setPredeterminado(resto[0]);
                          }}
                          className="rounded-full p-1 text-[var(--fg-muted)] hover:text-[var(--danger)]"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {canManage && (
                  <label className="mt-4 block max-w-xl">
                    <span className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">Añadir un modelo</span>
                    <select
                      value=""
                      onChange={(e) => e.target.value && cambia(setHabilitados)([...new Set([...habilitados, e.target.value])])}
                      className="lx-input lx-mono text-xs"
                    >
                      <option value="">Elige un modelo de tu cuenta…</option>
                      {modelosDe(esModeloDeTexto).map((g) => (
                        <optgroup key={g.proveedor.id} label={g.proveedor.label}>
                          {g.modelos
                            .filter((m) => !habilitados.includes(`${g.proveedor.id}:${m}`))
                            .map((m) => (
                              <option key={m} value={`${g.proveedor.id}:${m}`}>
                                {m}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
            {pie(hayCatalogo)}
          </div>
        )}

        {/* ---------------------------------------------------------------- Agente de la vaca */}
        {pestana === "vaca" && (
          <div className="max-w-xl">
            <h3 className="text-sm font-semibold">Agente de la vaca</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">
              El asistente público del sitio: responde a los lectores con fuentes citadas del archivo. Conviene un modelo rápido y barato, porque lo usan
              muchas personas. También escribe las preguntas de ejemplo que se ven al abrirlo.
            </p>
            {!hayCatalogo ? (
              <SinModelos />
            ) : (
              <label className="mt-4 block">
                <span className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">Modelo</span>
                {selector(asistente, cambia(setAsistente), modelosDe(esModeloDeTexto), "Igual que el predeterminado de los editores")}
              </label>
            )}
            {hayCatalogo && (
              <label className="mt-5 block">
                <span className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">Modelo de búsqueda (barato)</span>
                {selector(busqueda, cambia(setBusqueda), modelosDe(esModeloDeTexto), "El más barato de tu cuenta (automático)")}
                <span className="mt-1.5 block text-xs leading-relaxed text-[var(--fg-muted)]">
                  Antes de buscar, este modelo traduce la pregunta del lector a sinónimos y términos del sector, para encontrar notas aunque usen otras palabras. Gasta unos
                  180 tokens por pregunta (centavos por miles). Elige uno «lite», «mini», «nano» o «haiku».
                </span>
              </label>
            )}
            {pie(hayCatalogo)}
          </div>
        )}

        {/* ---------------------------------------------------------------- Imágenes */}
        {pestana === "imagenes" && (
          <div className="max-w-xl">
            <h3 className="text-sm font-semibold">Imágenes</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">Genera las fotos de portada de las notas (hasta 2K). Solo Gemini genera imágenes: se listan los modelos de imagen de tu cuenta.</p>
            {!hayCatalogo ? (
              <SinModelos />
            ) : (
              <label className="mt-4 block">
                <span className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">Modelo de imagen</span>
                {selector(imagen, cambia(setImagen), modelosDe(esModeloDeImagen, true), "Predeterminado del sistema")}
              </label>
            )}
            {pie(hayCatalogo)}
          </div>
        )}

        {/* ---------------------------------------------------------------- Videos */}
        {pestana === "videos" && (
          <div className="grid max-w-3xl grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">Entender videos</h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">Lee el audio de un video o una entrevista que sube el editor y lo convierte en material para la nota. Solo Gemini.</p>
              <label className="mt-3 block">
                {selector(videoEntender, cambia(setVideoEntender), modelosDe(esModeloDeTexto, true), "Igual que el principal (si es Gemini)")}
              </label>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Generar videos</h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">Crea clips de video con IA (familia Veo). El modelo queda guardado; el editor todavía no tiene el botón para usarlo.</p>
              <label className="mt-3 block">
                {selector(videoGenerar, cambia(setVideoGenerar), modelosDe(esModeloDeVideo, true), "Ninguno")}
              </label>
              {hayCatalogo && modelosDe(esModeloDeVideo, true).length === 0 && <p className="mt-2 text-xs text-[var(--fg-muted)]">Tu cuenta de Gemini no lista modelos de video. Pulsa «Actualizar modelos» en la pestaña Claves.</p>}
            </div>
            {!hayCatalogo && <SinModelos />}
            <div className="md:col-span-2">{pie(hayCatalogo)}</div>
          </div>
        )}

        {/* ---------------------------------------------------------------- Límites */}
        {pestana === "limites" && <div>{limites}</div>}

        {aviso && (
          <p className={`mt-4 flex items-start gap-2 text-xs ${aviso.tipo === "ok" ? "font-semibold text-[var(--accent-2)]" : "text-[var(--danger)]"}`} role="status">
            {aviso.tipo === "error" && <TriangleAlert size={13} className="mt-px shrink-0" />}
            {aviso.tipo === "ok" ? "✓ " : ""}
            {aviso.texto}
          </p>
        )}
      </div>
    </div>
  );
}

/** Aviso cuando todavía no hay un proveedor conectado (o no se ha leído su lista de modelos). */
function SinModelos() {
  return <p className="mt-4 rounded-[var(--radius)] bg-[var(--surface-2)] p-3 text-xs text-[var(--fg-muted)]">Primero conecta un proveedor en la pestaña «Claves»: de ahí salen los modelos disponibles de tu cuenta.</p>;
}

/** Tarjeta de un proveedor: estado de la clave, pegarla o cambiarla, actualizar su lista de modelos y quitarla. */
function ClaveProveedor({
  p,
  uso,
  canManage,
  onAviso,
}: {
  p: ConfigIA["proveedores"][number];
  uso: ResumenUsoIA | null;
  canManage: boolean;
  onAviso: (a: { tipo: "ok" | "error"; texto: string } | null) => void;
}) {
  const [clave, setClave] = useState("");
  const [pending, start] = useTransition();
  const delEntorno = p.source === "entorno";

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{p.label}</span>
        {p.present ? (
          <span className="lx-mono rounded-full bg-[var(--accent-2)]/15 px-2.5 py-1 text-xs text-[var(--accent-2)]">{p.masked}</span>
        ) : (
          <span className="rounded-full bg-[var(--danger)]/12 px-2.5 py-1 text-xs text-[var(--danger)]">Sin clave</span>
        )}
        {p.present && <span className="text-xs text-[var(--fg-muted)]">{delEntorno ? "del despliegue" : "guardada en el panel"}</span>}
      </div>
      <p className="mt-1 text-xs text-[var(--fg-muted)]">{p.catalogo.length > 0 ? `${p.catalogo.length} modelos disponibles en tu cuenta` : p.present ? "Aún no se ha leído la lista de modelos." : "Conéctalo para usar sus modelos."}</p>

      {canManage && (
        <div className="mt-3 space-y-2">
          {!delEntorno && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder={p.present ? "pega una clave nueva para reemplazarla" : "pega aquí la clave"}
                className="lx-input lx-mono min-w-0 flex-1 text-xs"
              />
              <button
                type="button"
                disabled={pending || clave.trim().length < 20}
                onClick={() =>
                  start(async () => {
                    const r = await guardarClaveIA(p.id, clave);
                    onAviso({ tipo: r.ok ? "ok" : "error", texto: r.message });
                    if (r.ok) setClave("");
                  })
                }
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-40"
              >
                {pending ? "Comprobando…" : "Guardar y comprobar"}
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {p.present && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await actualizarCatalogoIA(p.id);
                    onAviso({ tipo: r.ok ? "ok" : "error", texto: r.message });
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface-2)]"
              >
                <RefreshCw size={13} /> Actualizar modelos
              </button>
            )}
            {p.present && !delEntorno && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await eliminarClaveIA(p.id);
                    onAviso({ tipo: r.ok ? "ok" : "error", texto: r.message });
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
              >
                <Trash2 size={13} /> Eliminar clave
              </button>
            )}
            <a href={p.docs} target="_blank" rel="noreferrer" className="lx-link text-xs text-[var(--fg-muted)]">
              ¿Dónde consigo la clave?
            </a>
          </div>
        </div>
      )}
      <ConsumoProveedor proveedor={p.id} uso={uso} />
    </div>
  );
}

// Tokens en forma corta: 1,2 M · 850 k · 320.
const tokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M` : n >= 1_000 ? `${Math.round(n / 1_000)} k` : String(Math.round(n)));
const usd = (n: number) => `US$ ${n.toFixed(n < 10 ? 2 : 0).replace(".", ",")}`;

/** Consumo del mes de un proveedor (todos los usuarios): total, tokens y los modelos que más gastan. Estimado por tokens. */
function ConsumoProveedor({ proveedor, uso }: { proveedor: AiProviderId; uso: ResumenUsoIA | null }) {
  if (!uso) return null;
  const modelos = uso.modelos.filter((m) => m.proveedor === proveedor);
  const total = modelos.reduce((s, m) => s + m.usd, 0);
  const entrada = modelos.reduce((s, m) => s + m.entrada, 0);
  const salida = modelos.reduce((s, m) => s + m.salida, 0);
  const llamadas = modelos.reduce((s, m) => s + m.llamadas, 0);
  const max = Math.max(0.0001, ...modelos.map((m) => m.usd));
  return (
    <div className="mt-4 border-t border-[var(--border)] pt-3">
      <p className="flex items-baseline justify-between gap-2 text-xs font-semibold">
        <span>Consumo de {uso.mes}</span>
        <span className="lx-mono">{usd(total)}</span>
      </p>
      {modelos.length === 0 ? (
        <p className="mt-1 text-xs text-[var(--fg-muted)]">Sin consumo este mes.</p>
      ) : (
        <>
          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
            {tokens(entrada)} entrada · {tokens(salida)} salida · {llamadas} {llamadas === 1 ? "llamada" : "llamadas"} · todos los usuarios
          </p>
          <ul className="mt-2 space-y-1.5">
            {modelos.slice(0, 5).map((m) => (
              <li key={m.ref}>
                <p className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="lx-mono min-w-0 truncate" title={m.ref}>{m.modelo}</span>
                  <span className="lx-mono shrink-0 text-[var(--fg-muted)]">{usd(m.usd)} · {tokens(m.entrada + m.salida)}</span>
                </p>
                <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(4, (m.usd / max) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-2 text-[0.7rem] leading-snug text-[var(--fg-muted)]">Costo estimado por tokens; el saldo real está en el panel de {proveedor === "google" ? "Google AI Studio" : proveedor === "openai" ? "OpenAI" : "Anthropic"}.</p>
    </div>
  );
}
