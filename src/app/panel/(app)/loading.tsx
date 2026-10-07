/**
 * Esqueleto instantáneo del panel: al pasar de una sección a otra el menú y la barra se quedan y esto aparece de inmediato,
 * en vez de una pantalla congelada hasta que el servidor termine de consultar la base de datos.
 */
export default function CargandoPanel() {
  return (
    <div role="status" aria-label="Cargando" className="flex animate-pulse flex-col gap-5 sm:gap-6">
      <div className="h-10 w-72 max-w-full rounded-full bg-[var(--surface-2)]" />
      <div className="flex flex-col gap-2">
        <div className="h-3 w-24 rounded bg-[var(--surface-2)]" />
        <div className="h-9 w-80 max-w-full rounded bg-[var(--surface-2)]" />
        <div className="h-4 w-[34rem] max-w-full rounded bg-[var(--surface-2)]" />
      </div>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]" />)}
      </div>
      <div className="h-72 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
