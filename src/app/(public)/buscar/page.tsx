import Link from "next/link";
import type { Metadata } from "next";
import { hybridSearch } from "@/lib/search";
import { Input, Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "Buscar",
  robots: { index: false, follow: true }, // resultados de búsqueda no se indexan
};

type SP = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: SP) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const results = query
    ? await hybridSearch(query, 30).catch((e) => {
        console.error("BUSCAR error:", e);
        return [];
      })
    : [];

  return (
    <div className="rise mx-auto max-w-2xl">
      <h1 className="text-[2rem] font-extrabold tracking-[-0.025em]">Buscar</h1>
      <form action="/buscar" method="get" className="mt-5 flex gap-2">
        <Input name="q" defaultValue={query} placeholder="Ej: precios del novillo gordo" autoFocus />
        <Button type="submit">Buscar</Button>
      </form>

      {query && (
        <p className="mt-4 text-sm text-[var(--ink-faint)]">
          {results.length} resultado{results.length === 1 ? "" : "s"} para <span className="text-[var(--ink)]">“{query}”</span>.
          El índice combina artículos nuevos y el archivo histórico completo.
        </p>
      )}

      <ul className="mt-6 flex flex-col divide-y divide-[var(--line)]">
        {results.map((r) => (
          <li key={`${r.kind}-${r.id}`} className="py-5">
            <div className="flex items-center gap-2">
              {r.kind === "archivo" && (
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">
                  Archivo
                </span>
              )}
              <Link
                href={r.url}
                className="font-serif text-[19px] font-semibold leading-snug text-[var(--ink)] transition-colors hover:text-[var(--brand)]"
              >
                {r.title}
              </Link>
            </div>
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--ink-soft)]">{r.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
