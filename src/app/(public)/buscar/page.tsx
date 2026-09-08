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
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-extrabold">Buscar</h1>
      <form action="/buscar" method="get" className="mt-4 flex gap-2">
        <Input name="q" defaultValue={query} placeholder="Ej: precios del novillo gordo" autoFocus />
        <Button type="submit">Buscar</Button>
      </form>

      {query && (
        <p className="mt-4 text-sm text-[var(--fg-muted)]">
          {results.length} resultado{results.length === 1 ? "" : "s"} para “{query}”. El índice
          combina artículos nuevos y el archivo histórico completo.
        </p>
      )}

      <ul className="mt-6 flex flex-col divide-y divide-[var(--border)]">
        {results.map((r) => (
          <li key={`${r.kind}-${r.id}`} className="py-4">
            <Link href={r.url} className="text-lg font-semibold text-[var(--link)]">
              {r.title}
            </Link>
            {r.kind === "archivo" && (
              <span className="ml-2 align-middle text-xs text-[var(--fg-muted)]">archivo</span>
            )}
            <p className="mt-1 line-clamp-2 text-sm text-[var(--fg-muted)]">{r.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
