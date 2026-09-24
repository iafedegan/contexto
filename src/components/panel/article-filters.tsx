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
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className="lx-kicker text-[0.65rem] text-[var(--fg-muted)]">{label}</span>
      <select name={name} defaultValue={value} onChange={submit} className="lx-input min-w-0 !py-1.5 !pl-3 !text-sm leading-normal">
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
      className="lx-card grid grid-cols-2 gap-2 px-3 py-2 sm:grid-cols-4 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]"
    >
      <label className="col-span-2 flex min-w-0 flex-col gap-0.5 sm:col-span-4 lg:col-span-1">
        <span className="lx-kicker text-[0.65rem] text-[var(--fg-muted)]">Buscar</span>
        <input
          type="search"
          name="q"
          defaultValue={values.q}
          placeholder="Título o palabra clave…"
          className="lx-input !py-1.5 !px-3 !text-sm leading-normal"
        />
      </label>
      {select("estado", values.estado, "Estado", statuses, "Todos")}
      {select("categoria", values.categoria, "Categoría", categories, "Todas")}
      {select("autor", values.autor, "Autor", authors, "Todos")}
      {select("orden", values.orden, "Ordenar por", sorts)}
      <div className="col-span-2 flex items-end gap-2 sm:col-span-4 lg:col-span-1">
        <button type="submit" className="lx-btn flex-1 !py-2 lg:flex-none">
          Filtrar
        </button>
        {active && (
          <Link href="/panel/articulos" className="lx-link whitespace-nowrap py-1 text-sm">
            Limpiar
          </Link>
        )}
      </div>
    </form>
  );
}
