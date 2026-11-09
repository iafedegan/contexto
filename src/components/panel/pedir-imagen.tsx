"use client";

import { useEffect, useState, useTransition } from "react";
import { Brush, Check, Loader2 } from "lucide-react";
import { cancelarPedido, estadoDelPedido, pedirImagen } from "@/app/panel/(app)/imagenes/actions";
import type { PedidoImagen } from "@/lib/imagenes-pedidas-reglas";

const campo = "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-muted)]/50";

type Disenador = { id: string; nombre: string };

/**
 * En el paso «Imagen»: pedirle la portada al diseñador, ver si ya la hizo y usarla. El redactor puede seguir subiendo o generando la imagen
 * él mismo; esto es una alternativa. Sin `name` en los campos: no viajan con el formulario de la nota.
 */
export function PedirImagen({ articleId, titulo, resumen, portadaActual, alUsar }: { articleId: string; titulo: string; resumen: string; portadaActual: string; alUsar: (url: string) => void }) {
  const [pedido, setPedido] = useState<PedidoImagen | null>(null);
  const [disenadores, setDisenadores] = useState<Disenador[]>([]);
  const [cargado, setCargado] = useState(false);
  const [indicaciones, setIndicaciones] = useState("");
  const [disenadorId, setDisenadorId] = useState("");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, empezar] = useTransition();

  useEffect(() => {
    if (!articleId) return;
    let vigente = true;
    estadoDelPedido({ articleId })
      .then((e) => { if (vigente) { setPedido(e.pedido); setDisenadores(e.disenadores); setCargado(true); } })
      .catch(() => { if (vigente) setCargado(true); });
    return () => { vigente = false; };
  }, [articleId]);

  const nombreDe = (id: string | null) => disenadores.find((d) => d.id === id)?.nombre ?? "cualquier diseñador";

  function pedir() {
    setMensaje(null);
    empezar(async () => {
      const r = await pedirImagen({ articleId, indicaciones, disenadorId });
      setMensaje({ ok: r.ok, texto: r.message });
      if (r.ok) setPedido((await estadoDelPedido({ articleId })).pedido);
    });
  }

  function cancelar() {
    setMensaje(null);
    empezar(async () => {
      const r = await cancelarPedido({ articleId });
      setMensaje({ ok: r.ok, texto: r.message });
      setPedido((await estadoDelPedido({ articleId })).pedido);
    });
  }

  const entregada = pedido?.estado === "entregada" && pedido.url && pedido.url !== portadaActual;
  const pendienteDeEntrega = pedido?.estado === "pendiente";

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)]/50 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold"><Brush size={13} aria-hidden /> ¿Prefieres que la haga el diseñador?</p>
      {!articleId ? (
        <p className="mt-1.5 text-xs text-[var(--fg-muted)]">Guarda la nota primero y podrás pedirle la imagen.</p>
      ) : !cargado ? (
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[var(--fg-muted)]"><Loader2 size={12} className="animate-spin" /> Cargando…</p>
      ) : pendienteDeEntrega ? (
        <div className="mt-1.5 flex flex-col gap-2 text-xs">
          <p>Pedida a <strong>{nombreDe(pedido!.disenadorId)}</strong>. Cuando la entregue te aparece aquí y queda puesta en la nota.</p>
          <p className="whitespace-pre-line text-[var(--fg-muted)]">{pedido!.indicaciones}</p>
          <button type="button" onClick={cancelar} disabled={pendiente} className="lx-link self-start font-medium">Cancelar el pedido</button>
        </div>
      ) : entregada ? (
        <div className="mt-1.5 flex flex-col gap-2 text-xs">
          <p className="font-medium text-[#16a34a]">✓ El diseñador entregó la imagen.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pedido!.url} alt="" className="aspect-[16/9] w-full max-w-xs rounded-[var(--radius)] border border-[var(--border)] object-cover" />
          <button type="button" onClick={() => alUsar(pedido!.url!)} className="lx-btn self-start !px-3 !py-1.5 text-xs"><Check size={13} /> Usar esta imagen</button>
        </div>
      ) : (
        <details className="mt-1.5" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open && !indicaciones) setIndicaciones(`Imagen de portada para la nota «${titulo || "sin título"}».${resumen ? `\n${resumen.slice(0, 300)}` : ""}`); }}>
          <summary className="lx-link cursor-pointer text-xs font-medium">Pedir la imagen al diseñador</summary>
          <div className="mt-2 flex flex-col gap-2">
            <textarea value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} rows={4} placeholder="Qué imagen necesitas: la escena, el ambiente, lo que no debe faltar…" className={`${campo} resize-none`} />
            <select value={disenadorId} onChange={(e) => setDisenadorId(e.target.value)} className={campo} aria-label="Diseñador">
              <option value="">Cualquier diseñador</option>
              {disenadores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
            <button type="button" onClick={pedir} disabled={pendiente} className="lx-btn self-start !px-3 !py-1.5 text-xs">
              {pendiente ? <Loader2 size={13} className="animate-spin" /> : <Brush size={13} />} Enviar pedido
            </button>
          </div>
        </details>
      )}
      {mensaje && <p role={mensaje.ok ? "status" : "alert"} className={`mt-2 text-xs ${mensaje.ok ? "text-[#16a34a]" : "text-[var(--danger,#b4442e)]"}`}>{mensaje.texto}</p>}
    </div>
  );
}
