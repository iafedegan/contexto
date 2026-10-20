import Link from "next/link";
import { CalendarPlus, ClipboardList } from "lucide-react";

/** Las dos pestañas de «Consejo de redacción»: crear y abrir consejos, y ver las tareas de cada editor con su estado y su enlace. */
export type PestanaConsejo = "consejos" | "tareas";

export function TabsConsejo({ activa, abiertas }: { activa: PestanaConsejo; abiertas: number }) {
  const pestanas = [
    { id: "consejos" as const, t: "Crear un consejo", Icono: CalendarPlus, href: "/panel/consejo" },
    { id: "tareas" as const, t: "Tareas del equipo", Icono: ClipboardList, href: "/panel/consejo?tab=tareas", n: abiertas },
  ];
  return (
    <nav aria-label="Consejo de redacción" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ul className="inline-flex rounded-full border border-[var(--border-strong)] bg-[var(--surface)] p-0.5 shadow-[var(--shadow)]">
        {pestanas.map(({ id, t, Icono, href, n }) => (
          <li key={id}>
            <Link href={href} aria-current={activa === id ? "page" : undefined}
              className={`inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition ${activa === id ? "bg-[var(--accent)] !text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
              <Icono size={15} aria-hidden /> {t}
              {n ? <span className={`rounded-full px-2 text-xs ${activa === id ? "bg-white/25" : "bg-[var(--surface-2)]"}`}>{n}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
