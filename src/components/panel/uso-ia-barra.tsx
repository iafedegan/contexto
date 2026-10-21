"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Gauge } from "lucide-react";
import { usoIAResumen } from "@/app/panel/(app)/uso-ia-actions";

type Resumen = Awaited<ReturnType<typeof usoIAResumen>>;

// Números cortos para tokens: 1,2 M · 850 k · 320.
const tokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M` : n >= 1_000 ? `${Math.round(n / 1_000)} k` : String(Math.round(n)));
// Dólares: dos decimales por debajo de 10 y enteros por encima.
const usd = (n: number) => `US$ ${n.toFixed(n < 10 ? 2 : 0).replace(".", ",")}`;
const NOMBRE: Record<string, string> = { google: "Gemini", anthropic: "Claude", openai: "ChatGPT" };

/** Color de la barra según cuánto del presupuesto se ha gastado. */
const colorBarra = (pct: number) => (pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-[var(--accent-2)]");

/**
 * «Uso de IA»: barra desplegable que ve TODO el equipo, con lo gastado en el mes por cada modelo (sumando a todos), lo que lleva gastado la propia
 * persona frente a su cuota y, solo para administradores, el presupuesto del asistente público. En el menú lateral (`variante="lateral"`) sigue el despliegue del riel; en el celular va a ancho
 * completo. Los costos son estimados por tokens: el saldo real está en el panel de cada proveedor.
 */
export function UsoIaBarra({ variante = "lateral" }: { variante?: "lateral" | "movil" }) {
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<Resumen | null>(null);
  const [fallo, setFallo] = useState(false);

  const cargar = () => {
    usoIAResumen()
      .then((r) => {
        setDatos(r);
        setFallo(false);
      })
      .catch(() => setFallo(true));
  };
  // Se lee una vez al abrir la página, para mostrar el resumen en la barra cerrada.
  useEffect(() => {
    let vigente = true;
    usoIAResumen()
      .then((r) => vigente && setDatos(r))
      .catch(() => vigente && setFallo(true));
    return () => {
      vigente = false;
    };
  }, []);

  const lateral = variante === "lateral";
  // En el riel lateral el texto solo se ve con el menú desplegado, igual que el resto de elementos.
  const soloDesplegado = lateral ? "opacity-0 transition-opacity duration-150 group-hover/sb:opacity-100 group-focus-within/sb:opacity-100" : "";
  // La barra cerrada resume lo que importa a cada quien: el administrador, el presupuesto del asistente; el resto, su propia cuota.
  const pctAsistente = datos?.admin && datos.admin.presupuestoAsistenteUsd > 0 ? Math.min(100, (datos.admin.gastoAsistenteUsd / datos.admin.presupuestoAsistenteUsd) * 100) : 0;
  const cuota = datos?.yo.cuotaUsd ?? null;
  const pctYo = datos && cuota !== null && cuota > 0 ? Math.min(100, (datos.yo.gastoUsd / cuota) * 100) : 0;
  const pct = datos?.admin ? pctAsistente : pctYo;
  const hayGasto = datos ? (datos.admin ? datos.admin.gastoAsistenteUsd : datos.yo.gastoUsd) > 0 : false;
  const maxUsd = datos ? Math.max(0.0001, ...datos.modelos.map((m) => m.usd)) : 1;

  return (
    <div className={lateral ? "" : "border-t border-[var(--border)] pt-3"}>
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => {
          if (!abierto) cargar();
          setAbierto(!abierto);
        }}
        title="Uso de IA del mes por modelo"
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--fg-muted)] transition hover:bg-white/8 hover:text-white"
      >
        <Gauge size={20} className="shrink-0 opacity-80" aria-hidden />
        <span className={`min-w-0 flex-1 whitespace-nowrap ${soloDesplegado}`}>
          <span className="block">Uso de IA</span>
          {datos && (
            <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-white/15" aria-hidden>
              <span className={`block h-full rounded-full ${colorBarra(pct)}`} style={{ width: `${Math.max(pct, hayGasto ? 3 : 0)}%` }} />
            </span>
          )}
        </span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${abierto ? "rotate-180" : ""} ${soloDesplegado}`} aria-hidden />
      </button>

      {abierto && (
        <div className={`mt-1 space-y-3 rounded-xl bg-white/6 p-3 text-xs text-[var(--fg-muted)] ${soloDesplegado}`}>
          {fallo && !datos && <p>No se pudo leer el consumo. Inténtalo de nuevo.</p>}
          {!datos && !fallo && <p>Calculando…</p>}
          {datos && (
            <>
              <div>
                <p className="flex items-baseline justify-between gap-2 font-semibold text-white">
                  <span>Mi consumo</span>
                  <span className="lx-mono">{cuota !== null ? `${usd(datos.yo.gastoUsd)} / ${usd(cuota)}` : usd(datos.yo.gastoUsd)}</span>
                </p>
                {cuota !== null ? (
                  <>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
                      <div className={`h-full rounded-full ${colorBarra(pctYo)}`} style={{ width: `${Math.max(pctYo, datos.yo.gastoUsd > 0 ? 3 : 0)}%` }} />
                    </div>
                    <p className="mt-1">Te quedan {usd(Math.max(0, cuota - datos.yo.gastoUsd))} de tu cuota del mes{pctYo >= 100 ? ": ya no puedes generar con IA hasta el mes siguiente." : "."}</p>
                  </>
                ) : (
                  <p className="mt-1">Sin tope mensual: tu cuenta no tiene una cuota de IA fijada.</p>
                )}
              </div>

              {datos.admin && (
                <div>
                  <p className="flex items-baseline justify-between gap-2 font-semibold text-white">
                    <span>Asistente público</span>
                    <span className="lx-mono">{usd(datos.admin.gastoAsistenteUsd)} / {usd(datos.admin.presupuestoAsistenteUsd)}</span>
                  </p>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
                    <div className={`h-full rounded-full ${colorBarra(pctAsistente)}`} style={{ width: `${Math.max(pctAsistente, datos.admin.gastoAsistenteUsd > 0 ? 3 : 0)}%` }} />
                  </div>
                  <p className="mt-1">Quedan {usd(Math.max(0, datos.admin.presupuestoAsistenteUsd - datos.admin.gastoAsistenteUsd))} del presupuesto del mes{pctAsistente >= 100 ? ": el asistente responde solo en modo búsqueda." : "."}</p>
                </div>
              )}

              <div>
                <p className="font-semibold text-white">Por modelo · todo el equipo · {datos.mes}</p>
                {datos.modelos.length === 0 ? (
                  <p className="mt-1">Todavía no hay consumo este mes.</p>
                ) : (
                  <ul className="mt-1.5 space-y-2.5">
                    {datos.modelos.map((m) => (
                      <li key={m.ref}>
                        <p className="flex items-baseline justify-between gap-2">
                          <span className="lx-mono min-w-0 truncate text-white" title={m.ref}>{m.modelo}</span>
                          <span className="lx-mono shrink-0">{usd(m.usd)}</span>
                        </p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15">
                          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(4, (m.usd / maxUsd) * 100)}%` }} />
                        </div>
                        <p className="mt-0.5 opacity-80">
                          {NOMBRE[m.proveedor] ?? m.proveedor} · {tokens(m.entrada)} entrada · {tokens(m.salida)} salida · {m.llamadas} {m.llamadas === 1 ? "llamada" : "llamadas"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="flex items-baseline justify-between gap-2">
                <span>Total del equipo</span>
                <span className="lx-mono font-semibold text-white">{usd(datos.totalUsd)}</span>
              </p>
              {datos.admin && (
                <p className="flex items-baseline justify-between gap-2">
                  <span>Gastado por las personas</span>
                  <span className="lx-mono">{usd(datos.admin.gastoPersonasUsd)}</span>
                </p>
              )}
              <p className="leading-relaxed opacity-80">Costos estimados por tokens. El saldo real de cada proveedor está en su propio panel; aquí se ve lo que se consumió desde este sitio.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
