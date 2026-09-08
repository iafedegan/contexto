import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-extrabold">Página no encontrada</h1>
      <p className="text-[var(--fg-muted)]">
        Si llegaste desde un enlace antiguo, es posible que el contenido esté en el archivo
        histórico, que conserva sus direcciones originales.
      </p>
      <div className="flex gap-3 text-sm">
        <Link href="/" className="text-[var(--link)] underline">
          Inicio
        </Link>
        <Link href="/buscar" className="text-[var(--link)] underline">
          Buscar
        </Link>
      </div>
    </div>
  );
}
