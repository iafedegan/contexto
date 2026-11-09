import Link from "next/link";
import { KanbanSquare, List } from "lucide-react";

export type VistaArticulos = "lista" | "tablero";

// Las dos vistas de «Artículos»: la lista de siempre y el tablero por etapas (redactor, diseñador, editor…).
export function TabsArticulos({ activa }: { activa: VistaArticulos }) {
  const pestanas = [
    { id: "lista" as const, t: "Lista", Icono: List, href: "/panel/articulos" },
    { id: "tablero" as const, t: "Tablero por etapas", Icono: KanbanSquare, href: "/panel/articulos?vista=tablero" },
  ];
  return (
    <nav aria-label="Vistas de artículos" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ul className="inline-flex rounded-full border border-[var(--border-strong)] bg-[var(--surface)] p-0.5 shadow-[var(--shadow)]">
        {pestanas.map(({ id, t, Icono, href }) => (
          <li key={id}>
            <Link href={href} aria-current={activa === id ? "page" : undefined}
              className={`inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition ${activa === id ? "bg-[var(--accent)] !text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
              <Icono size={15} aria-hidden /> {t}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
