"use client";

import { useRef } from "react";
import Link from "next/link";

type Option = { value: string; label: string };

/**
 * Filtros de la lista de artículos. Es un formulario GET normal (funciona sin
 * JS); con JS, los selectores aplican el filtro en cuanto cambian.
 */
export function ArticleFilters({
  values,
  statuses,
  categories,
  authors,
  sorts,
}: {
  values: { q: string; estado: string; categoria: string; autor: string; orden: string };
  statuses: Option[];
  categories: Option[];
  authors: Option[];
  sorts: Option[];
}) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();
  const active = Boolean(values.q || values.estado || values.categoria || values.autor);

  const select = (name: string, value: string, label: string, options: Option[], all?: string) => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="lx-kicker text-[var(--fg-muted)]">{label}</span>
      <select name={name} defaultValue={value} onChange={submit} className="lx-input py-2">
        {all && <option value="">{all}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form
      ref={form}
      method="get"
      className="lx-card grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]"
    >
      <label className="flex min-w-0 flex-col gap-1">
        <span className="lx-kicker text-[var(--fg-muted)]">Buscar</span>
        <input
          type="search"
          name="q"
          defaultValue={values.q}
          placeholder="Título o palabra clave…"
          className="lx-input py-2"
        />
      </label>
      {select("estado", values.estado, "Estado", statuses, "Todos")}
      {select("categoria", values.categoria, "Categoría", categories, "Todas")}
      {select("autor", values.autor, "Autor", authors, "Todos")}
      {select("orden", values.orden, "Ordenar por", sorts)}
      <div className="flex items-end gap-2">
        <button type="submit" className="lx-btn py-2">
          Filtrar
        </button>
        {active && (
          <Link href="/panel/articulos" className="lx-link whitespace-nowrap py-2 text-sm">
            Limpiar
          </Link>
        )}
      </div>
    </form>
  );
}
