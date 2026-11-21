import Link from "next/link";
import { BarChart3, FileText, ListTree, Smartphone, Users } from "lucide-react";

/**
 * Las tres pestañas de la opción «Resumen» del panel: el estado editorial (`/panel`) y el centro de análisis, que se parte en
 * Audiencia, Lectores, Suscriptores y SuperApp (`/panel/analitica`). Las dos últimas solo aparecen a quien tiene el permiso «analitica».
 * `parametros` (periodo y filtros) pasa de una pestaña de análisis a la otra para no perder lo que se estaba mirando.
 */
export type PestanaResumen = "resumen" | "audiencia" | "lectores" | "suscriptores" | "superapp";

export function TabsResumen({ activa, analitica, parametros = "" }: { activa: PestanaResumen; analitica: boolean; parametros?: string }) {
  const p = parametros.replace(/^\?/, "");
  const con = (extra: string) => {
    const q = [p, extra].filter(Boolean).join("&");
    return q ? `/panel/analitica?${q}` : "/panel/analitica";
  };
  const pestanas = [
    ...(analitica
      ? [
          { id: "audiencia" as const, t: "Audiencia", Icono: BarChart3, href: con("") },
          { id: "lectores" as const, t: "Lectores", Icono: ListTree, href: con("vista=lectores") },
          { id: "suscriptores" as const, t: "Suscriptores", Icono: Users, href: con("vista=suscriptores") },
          { id: "superapp" as const, t: "SuperApp", Icono: Smartphone, href: con("vista=superapp") },
        ]
      : []),
  ];
  if (!analitica) return null; // sin permiso de análisis no hay nada que alternar
  return (
    // En el celular las cinco pestañas no caben: cada una conserva su ancho y la tira se desliza de lado (antes se apretaban y los nombres
    // se montaban unos sobre otros, «SuscriptoresSuperApp»).
    <nav aria-label="Resumen y análisis" className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none]">
      <ul className="flex w-max min-w-full rounded-full sm:inline-flex sm:w-auto sm:min-w-0 border border-[var(--border-strong)] bg-[var(--surface)] p-0.5 shadow-[var(--shadow)]">
        {pestanas.map(({ id, t, Icono, href }) => (
          <li key={id} className="flex-1 sm:flex-none">
            <Link href={href} aria-current={activa === id ? "page" : undefined}
              className={`inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full px-2.5 text-[0.8125rem] sm:w-auto sm:px-4 sm:text-sm font-semibold transition ${activa === id ? "bg-[var(--accent)] text-white!" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
              <Icono size={15} aria-hidden className="hidden min-[430px]:block" /> {t}
            </Link>
          </li>
        ))}
        <li className="flex-1 sm:flex-none">
          <Link href={`/panel/analitica/informe${p ? `?${p}` : ""}`} className="inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full px-2.5 text-[0.8125rem] font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-2)] sm:w-auto sm:px-4 sm:text-sm">
            <FileText size={15} aria-hidden className="hidden min-[430px]:block" /> Informe
          </Link>
        </li>
      </ul>
    </nav>
  );
}
