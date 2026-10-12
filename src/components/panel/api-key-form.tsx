"use client";

import { useState, useTransition } from "react";
import { KeyRound, Trash2, TriangleAlert } from "lucide-react";
import { AI_PROVIDERS, DEFAULT_IMAGE_MODEL, esModeloDeImagen, type KeyStatus } from "@/lib/ai-providers";
import { deleteApiKey, saveAiSettings } from "@/app/panel/(app)/configuracion/actions";

/**
 * Proveedor, modelo y clave.
 *
 * La clave se envía, se cifra y no vuelve: la pantalla solo muestra una
 * máscara (`sk-ant-…a1b2`) para reconocerla. Si la clave viene del entorno del
 * despliegue, aquí no se puede sustituir: esa decisión es de quien opera el
 * servidor, no de una sesión del panel.
 */
export function ApiKeyForm({ status, canManage }: { status: KeyStatus; canManage: boolean }) {
  const [provider, setProvider] = useState(status.provider);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  const meta = AI_PROVIDERS.find((p) => p.id === provider) ?? AI_PROVIDERS[0];
  const fromEnv = status.source === "entorno";
  const catalogo = provider === status.provider ? status.models : [];
  // Solo los modelos que generan imágenes; si el elegido antes ya no está en el catálogo, se conserva para no perderlo en silencio.
  const imagenes = catalogo.filter(esModeloDeImagen);
  if (status.imageModel && !imagenes.includes(status.imageModel)) imagenes.unshift(status.imageModel);
  const sameProvider = provider === status.provider;

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[var(--accent)]">
          <KeyRound size={14} />
        </span>
        <span className="text-sm font-semibold">Proveedor de modelo</span>
        {status.present ? (
          <span className="lx-mono rounded-full bg-[var(--accent-2)]/15 px-2.5 py-1 text-xs text-[var(--accent-2)]">
            {status.masked}
          </span>
        ) : (
          <span className="rounded-full bg-[var(--danger)]/12 px-2.5 py-1 text-xs text-[var(--danger)]">
            Sin clave
          </span>
        )}
      </div>

      {!canManage ? (
        <p className="mt-3 text-xs text-[var(--fg-muted)]">
          Solo un administrador puede gestionar el proveedor y su clave.
        </p>
      ) : (
        <>
          <form
            action={(fd) => {
              setError(null);
              setOk(false);
              start(async () => {
                try {
                  await saveAiSettings(fd);
                  setOk(true);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "No se pudo guardar.");
                }
              });
            }}
            className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <label className="block">
              <span className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
                Proveedor
              </span>
              <select
                name="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as typeof provider)}
                className="lx-input text-sm"
              >
                {AI_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-baseline gap-2">
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
                  Modelo
                </span>
                <span className="text-xs text-[var(--fg-muted)]/75">
                  {catalogo.length > 0
                    ? `${catalogo.length} disponibles en tu cuenta`
                    : "guarda la clave para ver los tuyos"}
                </span>
              </span>
              {catalogo.length > 0 ? (
                <select
                  name="model"
                  defaultValue={catalogo.includes(status.model) ? status.model : catalogo[0]}
                  key={provider}
                  className="lx-input lx-mono text-xs"
                >
                  {catalogo.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name="model"
                  defaultValue={sameProvider ? status.model : ""}
                  key={provider}
                  placeholder="se completa al validar la clave"
                  className="lx-input lx-mono text-xs"
                />
              )}
            </label>

            {provider === "google" && (
              <label className="block sm:col-span-2">
                <span className="mb-1.5 flex items-baseline gap-2">
                  <span className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
                    Modelo para gráficas
                  </span>
                  <span className="text-xs text-[var(--fg-muted)]/75">
                    busca cifras en Google y dibuja la gráfica; elige uno que admita búsqueda (los «lite» pueden no hacerlo)
                  </span>
                </span>
                <select
                  name="chartModel"
                  defaultValue={status.chartModel}
                  key={`chart-${provider}`}
                  className="lx-input lx-mono text-xs"
                >
                  <option value="">Igual que el modelo principal</option>
                  {catalogo.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {provider === "google" && (
              <label className="block sm:col-span-2">
                <span className="mb-1.5 flex items-baseline gap-2">
                  <span className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
                    Modelo para imágenes
                  </span>
                  <span className="text-xs text-[var(--fg-muted)]/75">
                    genera las fotos de portada en 2K; solo se listan los modelos de imagen de tu cuenta
                  </span>
                </span>
                <select
                  name="imageModel"
                  defaultValue={status.imageModel}
                  key={`image-${provider}`}
                  className="lx-input lx-mono text-xs"
                >
                  <option value="">Predeterminado ({DEFAULT_IMAGE_MODEL})</option>
                  {imagenes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block sm:col-span-2">
              <span className="mb-1.5 flex items-baseline gap-2">
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
                  Clave de la API
                </span>
                <span className="text-xs text-[var(--fg-muted)]/75">
                  {fromEnv && sameProvider
                    ? `la manda la variable ${meta.envVar} del despliegue`
                    : status.present && sameProvider
                      ? "déjala vacía para conservar la actual"
                      : "se comprueba contra el proveedor antes de guardarla"}
                </span>
              </span>
              <input
                name="apiKey"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="pega aquí la clave"
                disabled={fromEnv && sameProvider}
                className="lx-input lx-mono text-xs"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-40"
              >
                {pending ? "Comprobando clave…" : "Guardar"}
              </button>

              {status.present && status.source === "panel" && sameProvider && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(() => deleteApiKey(status.provider))}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 py-2 text-xs font-medium transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
                >
                  <Trash2 size={13} /> Eliminar clave
                </button>
              )}

              <a
                href={meta.docs}
                target="_blank"
                rel="noreferrer"
                className="lx-link text-xs text-[var(--fg-muted)]"
              >
                ¿Dónde consigo la clave?
              </a>

              {ok && <span className="text-xs font-semibold text-[var(--accent-2)]">Guardado ✓</span>}
            </div>
          </form>

          {error && (
            <p className="mt-2 flex items-start gap-2 text-xs text-[var(--danger)]">
              <TriangleAlert size={13} className="mt-px shrink-0" /> {error}
            </p>
          )}

          <p className="mt-3 text-xs leading-relaxed text-[var(--fg-muted)]">
            La clave se guarda cifrada (AES-256-GCM) con el secreto del despliegue, nunca en texto
            plano, y no se devuelve al navegador. Si cambias{" "}
            <code className="lx-mono">AUTH_SECRET</code>, habrá que volver a introducirla.
          </p>
        </>
      )}
    </div>
  );
}
