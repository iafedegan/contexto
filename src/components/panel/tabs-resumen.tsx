import Link from "next/link";
import { BarChart3, LayoutDashboard, Users } from "lucide-react";

/**
 * Las tres pestañas de la opción «Resumen» del panel: el estado editorial (`/panel`) y el centro de análisis, que se parte en
 * Audiencia y Suscriptores (`/panel/analitica`). Las dos últimas solo aparecen a quien tiene el permiso «analitica».
 * `parametros` (periodo y filtros) pasa de una pestaña de análisis a la otra para no perder lo que se estaba mirando.
 */
export type PestanaResumen = "resumen" | "audiencia" | "suscriptores";

export function TabsResumen({ activa, analitica, parametros = "" }: { activa: PestanaResumen; analitica: boolean; parametros?: string }) {
  const p = parametros.replace(/^\?/, "");
  const con = (extra: string) => {
    const q = [p, extra].filter(Boolean).join("&");
    return q ? `/panel/analitica?${q}` : "/panel/analitica";
  };
  const pestanas = [
    { id: "resumen" as const, t: "Resumen", Icono: LayoutDashboard, href: "/panel" },
    ...(analitica
      ? [
          { id: "audiencia" as const, t: "Audiencia", Icono: BarChart3, href: con("") },
          { id: "suscriptores" as const, t: "Suscriptores", Icono: Users, href: con("vista=suscriptores") },
        ]
      : []),
  ];
  if (pestanas.length < 2) return null; // sin permiso de análisis no hay nada que alternar
  return (
    <nav aria-label="Resumen y análisis" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ul className="inline-flex rounded-full border border-[var(--border-strong)] bg-[var(--surface)] p-0.5 shadow-[var(--shadow)]">
        {pestanas.map(({ id, t, Icono, href }) => (
          <li key={id}>
            <Link href={href} aria-current={activa === id ? "page" : undefined}
              className={`inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition ${activa === id ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
              <Icono size={15} aria-hidden /> {t}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
