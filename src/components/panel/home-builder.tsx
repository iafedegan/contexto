"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bold,
  ChevronDown,
  Columns2,
  Palette,
  Image as ImageIcon,
  Italic,
  LayoutGrid,
  Megaphone,
  Monitor,
  Paintbrush,
  Layers,
  Rows3,
  RotateCcw,
  Save,
  Smartphone,
  Tablet,
  Type,
  X,
} from "lucide-react";
import { FeatureStrip } from "@/components/feature-strip";
import { AdsZoneForm } from "@/components/panel/ads-zone-form";
import type { AdsZoneRow } from "@/lib/ads";
import { TEMPLATE_COMPONENTS } from "@/components/home/templates";
import {
  saveHomeLayout,
  resetHomeLayout,
  saveHomeSectionLayout,
  type HomeLayoutEntry,
} from "@/app/panel/(app)/portada/actions";
import type { ArticleListItem } from "@/lib/content";
import type { HomeBackground, HomeLayoutConfig, HomeStyle } from "@/db/schema";
import { HOME_TEMPLATES } from "@/lib/home-layout";
import { BACKGROUND_PRESETS, homeBackgroundStyle } from "@/lib/home-background";
import { regionsCss, type RegionId } from "@/lib/home-regions";
import { RegionEditor } from "@/components/panel/region-editor";
import { PartsEditor } from "@/components/panel/parts-editor";
import { resolveParts, type FooterId, type NavbarId } from "@/lib/template-parts";
import { HOME_FONTS, HOME_FONT_GROUPS, type HomeTitleFont } from "@/lib/home-fonts";
import { cn } from "@/lib/utils";

type Item = ArticleListItem & { id: string; homePosition: number | null };
type Layout = Required<HomeLayoutConfig>;

function serializeItems(items: Item[]) {
  return items.map((i) => `${i.id}:${JSON.stringify(i.homeStyle ?? null)}`).join("|");
}

export function HomeBuilder({
  initialItems,
  initialLayout,
  headerVariants,
  footerVariants,
  adsZones,
  canManagePauta,
}: {
  initialItems: Item[];
  initialLayout: Layout;
  /**
   * Una cabecera real (Server Component) ya renderizada por plantilla — la
   * estructura de la cabecera cambia por plantilla, no solo el color, así
   * que el editor necesita poder cambiar cuál mostrar en cuanto el usuario
   * elige otra plantilla, sin recargar la página. Las 4 se piden de una
   * sola vez en el servidor y aquí solo se elige cuál montar.
   */
  /** Un navbar renderizado por cada pieza (NAVBARS). */
  headerVariants: Record<NavbarId, React.ReactNode>;
  /** El pie también cambia con la plantilla, igual que la cabecera. */
  /** Un footer renderizado por cada pieza (FOOTERS). */
  footerVariants: Record<FooterId, React.ReactNode>;
  /** Las 7 zonas de pauta, gestionables sin salir del editor de portada. */
  adsZones: AdsZoneRow[];
  canManagePauta: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [region, setRegion] = useState<RegionId>("navbar");
  // "template": elegir la plantilla. "content": la página real, editable —
  // clic para estilo, arrastrar para reordenar. La disposición de secciones
  // (columnas, dirección de "En breve") se ajusta desde "content" también,
  // como un panel flotante — es una decisión de contenido, no de plantilla.
  const [viewport, setViewport] = useState<"escritorio" | "tablet" | "movil">("escritorio");
  const [anchoLienzo, setAnchoLienzo] = useState(1440);
  const lienzoRef = useRef<HTMLDivElement>(null);
  const dragIndex = useRef<number | null>(null);
  const wasDragged = useRef(false);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const initialItemsSerialized = useMemo(() => serializeItems(initialItems), [initialItems]);
  const initialLayoutSerialized = useMemo(() => JSON.stringify(initialLayout), [initialLayout]);
  const dirty = serializeItems(items) !== initialItemsSerialized || JSON.stringify(layout) !== initialLayoutSerialized;

  // El lienzo cambia de ancho con la ventana y con la barra lateral.
  useEffect(() => {
    const el = lienzoRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setAnchoLienzo(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function move(from: number, to: number) {
    setItems((prev) => {
      const next = prev.slice();
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });
    setSaved(false);
  }

  function patchStyle(index: number, partial: Partial<HomeStyle> | null) {
    setItems((prev) => {
      const next = prev.slice();
      const merged: HomeStyle | null = partial === null ? null : { ...next[index].homeStyle, ...partial };
      if (merged) {
        (Object.keys(merged) as (keyof HomeStyle)[]).forEach((k) => merged[k] === undefined && delete merged[k]);
      }
      next[index] = { ...next[index], homeStyle: merged && Object.keys(merged).length > 0 ? merged : null };
      return next;
    });
    setSaved(false);
  }

  function patchLayout(partial: Partial<Layout>) {
    setLayout((prev) => ({ ...prev, ...partial }));
    setSaved(false);
  }

  function dragProps(index: number): React.HTMLAttributes<HTMLDivElement> {
    return {
      draggable: true,
      onDragStart: () => {
        dragIndex.current = index;
        wasDragged.current = false;
      },
      onDragEnter: () => {
        setOverIndex(index);
        wasDragged.current = true;
      },
      onDragOver: (e: React.DragEvent) => e.preventDefault(),
      onDrop: () => {
        if (dragIndex.current !== null && dragIndex.current !== index) move(dragIndex.current, index);
        dragIndex.current = null;
        setOverIndex(null);
      },
      onDragEnd: () => {
        dragIndex.current = null;
        setOverIndex(null);
        setTimeout(() => (wasDragged.current = false), 0);
      },
      onClick: () => {
        if (wasDragged.current) return;
        setSelected(index);
      },
    };
  }

  function hasStyle(index: number) {
    return Boolean(items[index]?.homeStyle);
  }

  function save() {
    const entries: HomeLayoutEntry[] = items.map((i) => ({ id: i.id, homeStyle: i.homeStyle }));
    startTransition(async () => {
      await Promise.all([saveHomeLayout(entries), saveHomeSectionLayout(layout)]);
      setSaved(true);
      router.refresh();
    });
  }

  function reset() {
    startTransition(async () => {
      await Promise.all([resetHomeLayout(), saveHomeSectionLayout({})]);
      setSelected(null);
      router.refresh();
    });
  }

  if (items.length === 0) {
    return <p className="meta">No hay artículos publicados todavía.</p>;
  }

  const lead = items[0];
  const second = items[1];
  const rail = items.slice(2, 6);
  const river = items.slice(6);
  // Plantilla compuesta: la paleta es `templateId`; navbar, cuerpo y footer
  // pueden venir de plantillas distintas.
  const parts = resolveParts(layout.templateId, layout.parts);
  const Template = TEMPLATE_COMPONENTS[parts.body] ?? TEMPLATE_COMPONENTS.clasico;

  // Misma composición que la portada pública (src/app/(public)/page.tsx),
  // para que esta vista sea un espejo real y no una cuadrícula genérica aparte.
  const opinion = items.find((a) => a.categorySlug === "opinion");
  const strip = [
    { label: "Actualidad", article: items[1] ?? items[0] },
    { label: "Especiales", article: items[2] ?? items[0] },
    { label: "Columna destacada", article: opinion ?? items[3] ?? items[0] },
  ].filter((x) => x.article);

  // Anchos REALES de dispositivo. El lienzo es más estrecho que un monitor,
  // así que se renderiza a tamaño real y se reduce con `zoom` (a diferencia de
  // `transform: scale`, `zoom` sí afecta al layout y el scroll sigue cuadrando).
  const anchoPreview = { escritorio: 1440, tablet: 834, movil: 390 }[viewport];
  const escala = Math.min(1, anchoLienzo / anchoPreview);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
      {/* ------------------------------------------------------- Lienzo */}
      <div className="flex min-w-0 flex-col gap-3">
        <div
          data-theme="panel-ui"
          className="flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[var(--fg)] shadow-[var(--shadow)]"
        >
          <button
            onClick={save}
            disabled={!dirty || pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={15} />
            {pending ? "Guardando…" : "Guardar diseño"}
          </button>
          <button
            onClick={reset}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3.5 py-2 text-xs font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
          >
            <RotateCcw size={13} />
            Restablecer
          </button>

          {/* Vista previa a distintos anchos: la portada se publica igual en
              móvil que en escritorio y conviene verla antes de guardar. */}
          <div className="ml-1 flex items-center gap-0.5 rounded-full border border-[var(--border)] p-0.5">
            {(
              [
                ["escritorio", Monitor, "Escritorio"],
                ["tablet", Tablet, "Tablet"],
                ["movil", Smartphone, "Móvil"],
              ] as const
            ).map(([id, Icono, etiqueta]) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewport(id)}
                title={etiqueta}
                aria-pressed={viewport === id}
                className={`rounded-full p-1.5 transition ${
                  viewport === id
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "text-[var(--fg-muted)] hover:text-[var(--accent)]"
                }`}
              >
                <Icono size={14} />
              </button>
            ))}
          </div>

          <span className="ml-auto text-xs text-[var(--fg-muted)]">
            {dirty ? (
              <span className="font-semibold text-[var(--fg)]">Cambios sin guardar</span>
            ) : saved ? (
              <span className="font-semibold text-[var(--accent-2)]">Guardado ✓</span>
            ) : (
              "Clic en una tarjeta · arrastra para reordenar"
            )}
          </span>
        </div>

        {/* Marco del lienzo: la portada real, a escala de su ancho elegido. */}
        <div
          ref={lienzoRef}
          className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-2)] p-3 shadow-[var(--shadow)]"
        >
          <p className="mb-2 text-center text-[0.68rem] text-[var(--fg-muted)]">
            {anchoPreview} px · {Math.round(escala * 100)} %
          </p>
          {/* El alto se limita FUERA del zoom: dentro de un elemento con
              `zoom`, las unidades (dvh, rem) también se escalan y el lienzo
              quedaba mucho más bajo de lo pedido. */}
          <div className="h-[calc(100dvh-15rem)] min-h-[26rem] overflow-y-auto overflow-x-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--paper)]">
          <div
            className="mx-auto bg-[var(--paper)]"
            style={{ width: anchoPreview, zoom: escala }}
            // Clic en navbar, pie, cuerpo… selecciona ese componente en el panel.
            // Los enlaces de la vista previa no navegan.
            onClickCapture={(e) => {
              const el = e.target as HTMLElement;
              if (el.closest("a")) e.preventDefault();
              const r = el.closest("[data-region]")?.getAttribute("data-region") as RegionId | null;
              if (r) setRegion(r);
            }}
          >
            <div
              className="flex min-h-full flex-col bg-[var(--paper)] text-[var(--ink)] transition-colors"
              data-theme={layout.templateId}
              data-site-root
              style={homeBackgroundStyle(layout.background)}
            >
              <style
                dangerouslySetInnerHTML={{
                  __html:
                    regionsCss(layout.regions) +
                    // Marca en el lienzo el componente que se está editando.
                    `\n[data-site-root] [data-region="${region}"]{outline:2px dashed #b45309;outline-offset:-2px}`,
                }}
              />
              {headerVariants[parts.navbar]}
              <main data-region="body" className="shell flex-1 py-8">
                <div className="flex flex-col gap-10">
                  {layout.templateId === "clasico" && <FeatureStrip items={strip} />}
                  <Template
                    lead={lead}
                    second={second}
                    rail={rail}
                    river={river}
                    layout={layout}
                    interactive={false}
                    builderSelected={selected}
                    builderOverIndex={overIndex}
                    builderDragProps={dragProps}
                    builderHasStyle={hasStyle}
                  />
                </div>
              </main>
              {footerVariants[parts.footer]}
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------ Controles */}
      <aside
        data-theme="panel-ui"
        className="flex flex-col gap-3 text-[var(--fg)] xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto xl:pr-1"
      >
        <Bloque titulo="Plantilla" icono={<LayoutGrid size={13} />}>
          <TemplatePicker layout={layout} onPick={(config) => patchLayout({ ...config, parts: {} })} compacto />
        </Bloque>

        <Bloque titulo="Crear plantilla" icono={<Layers size={13} />}>
          <PartsEditor layout={layout} onChange={patchLayout} />
        </Bloque>

        <Bloque titulo="Componentes" icono={<Paintbrush size={13} />} abierto>
          <RegionEditor
            value={layout.regions ?? {}}
            active={region}
            onActive={setRegion}
            onChange={(regions) => patchLayout({ regions })}
          />
        </Bloque>

        <Bloque titulo="Disposición y fondo" icono={<Rows3 size={13} />}>
          <SectionSettings layout={layout} onChange={patchLayout} />
        </Bloque>

        {/* Se remonta al cambiar la selección para abrirse solo cuando el
            editor acaba de pulsar una tarjeta. */}
        <Bloque
          key={`tarjeta-${selected ?? "vacia"}`}
          titulo={selected !== null ? `Tarjeta #${selected + 1}` : "Tarjeta"}
          icono={<Type size={13} />}
          abierto={selected !== null}
        >
          {selected !== null && items[selected] ? (
            <Inspector
              item={items[selected]}
              showSpan={selected >= 6}
              onChange={(p) => patchStyle(selected, p)}
              onClear={() => patchStyle(selected, null)}
              onClose={() => setSelected(null)}
            />
          ) : (
            <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
              Haz clic en cualquier tarjeta del lienzo para ajustar su tipografía, color, tamaño e
              imagen. Arrástrala para cambiar su posición en la portada.
            </p>
          )}
        </Bloque>

        {/* Las mismas zonas que en Configuración › Publicidad, aquí también:
            quien diseña la portada no debería tener que salir a otra pantalla
            para activar o cambiar un banner. */}
        <Bloque titulo="Publicidad" icono={<Megaphone size={13} />}>
          <div className="flex flex-col gap-3">
            {adsZones.map((z) => (
              <AdsZoneForm key={z.key} zone={z} canManage={canManagePauta} />
            ))}
          </div>
          {!canManagePauta && (
            <p className="mt-2 text-[0.68rem] leading-snug text-[var(--fg-muted)]">
              Solo un administrador puede cambiar la pauta.
            </p>
          )}
        </Bloque>
      </aside>
    </div>
  );
}

/** Bloque plegable de la barra lateral. Arranca cerrado salvo que se pida. */
function Bloque({
  titulo,
  icono,
  children,
  abierto = false,
}: {
  titulo: string;
  icono: React.ReactNode;
  children: React.ReactNode;
  /** Estado inicial; después manda el usuario. Por defecto, plegado. */
  abierto?: boolean;
}) {
  return (
    <details
      open={abierto}
      className="group rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] shadow-[var(--shadow)]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
        <span className="text-[var(--accent)]">{icono}</span>
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
          {titulo}
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className="ml-auto text-[var(--fg-muted)] transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-[var(--border)] p-4">{children}</div>
    </details>
  );
}

function SegButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
        active ? "bg-[var(--brand)] text-white" : "bg-[var(--paper-2)] text-[var(--ink-soft)] hover:text-[var(--fg)]"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Selector de tipografía del titular, como lista desplegable.
 *
 * No es un `<select>` nativo: Chrome no respeta `font-family` en las
 * `<option>`, y aquí lo importante es ver cada fuente dibujada con su propia
 * letra. Se despliega EN LÍNEA (no flotando) porque el panel tiene scroll
 * propio y una capa absoluta quedaría recortada por él.
 */
function FontPicker({
  value,
  onChange,
}: {
  value: HomeTitleFont | undefined;
  onChange: (font: HomeTitleFont | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const actual = HOME_FONTS.find((f) => f.id === value);

  function pick(font: HomeTitleFont | undefined) {
    onChange(font);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={actual ? { fontFamily: actual.cssVar } : undefined}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-2 text-left text-[0.95rem] transition hover:border-[var(--accent)]"
      >
        <span className="min-w-0 truncate">
          {actual ? actual.label : "Auto · la del diseño de la tarjeta"}
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className={`shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Tipografía del titular"
          className="mt-1.5 max-h-64 overflow-y-auto overflow-x-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] p-1 shadow-lg"
        >
          <FontOption selected={!value} onSelect={() => pick(undefined)}>
            Auto · la del diseño de la tarjeta
          </FontOption>

          {HOME_FONT_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="meta px-2 pb-0.5 pt-2 !text-[0.65rem]">{group.label}</p>
              {HOME_FONTS.filter((f) => f.group === group.id).map((f) => (
                <FontOption
                  key={f.id}
                  selected={value === f.id}
                  onSelect={() => pick(f.id)}
                  fontFamily={f.cssVar}
                >
                  {f.label}
                </FontOption>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Color del titular: muestras rápidas + cuentagotas.
 *
 * "Auto" no guarda color, para que el titular siga heredando el del tema y sus
 * estados de :hover; fijar un color lo congela en todas las plantillas.
 */
const TITLE_COLORS = [
  { label: "Tinta", value: "#141210" },
  { label: "Marfil", value: "#f6f2e8" },
  { label: "Oro", value: "#d8b558" },
  { label: "Burdeos", value: "#7b1e2b" },
  { label: "Esmeralda", value: "#2f9c62" },
  { label: "Cobre", value: "#c97b3f" },
  { label: "Zafiro", value: "#1d4ed8" },
  { label: "Violeta", value: "#8b5cf6" },
];

function ColorPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (color: string | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(undefined)}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
          !value
            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
            : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)]"
        }`}
      >
        Auto
      </button>

      {TITLE_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          aria-label={c.label}
          aria-pressed={value?.toLowerCase() === c.value}
          onClick={() => onChange(c.value)}
          style={{ background: c.value }}
          className={`size-7 rounded-full border-2 transition hover:scale-110 ${
            value?.toLowerCase() === c.value
              ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40"
              : "border-[var(--border-strong)]"
          }`}
        />
      ))}

      <label
        className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-[var(--fg-muted)]"
        title="Elegir un color exacto"
      >
        <input
          type="color"
          value={value ?? "#141210"}
          onChange={(e) => onChange(e.target.value)}
          className="size-7 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0.5"
          aria-label="Color personalizado del titular"
        />
        Otro
      </label>
    </div>
  );
}

function FontOption({
  children,
  selected,
  onSelect,
  fontFamily,
}: {
  children: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  fontFamily?: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      style={fontFamily ? { fontFamily } : undefined}
      className={`block w-full min-w-0 truncate rounded-md px-2.5 py-1.5 text-left text-[0.95rem] transition ${
        selected
          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
          : "hover:bg-[var(--surface-2)]"
      }`}
    >
      {children}
    </button>
  );
}

function TemplatePicker({
  layout,
  onPick,
  compacto = false,
}: {
  layout: Layout;
  onPick: (config: Layout) => void;
  /** En la barra lateral: una columna y sin descripción larga. */
  compacto?: boolean;
}) {
  const activeId = HOME_TEMPLATES.find((t) => t.id === layout.templateId)?.id;

  return (
    <div className={compacto ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      {!compacto && <p className="kicker !text-[var(--accent)]">Elige la plantilla de portada</p>}
      <div className={compacto ? "grid gap-2" : "grid gap-3 sm:grid-cols-3"}>
        {HOME_TEMPLATES.map((t) => {
          const active = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t.config)}
              className={`flex flex-col gap-2.5 rounded-lg border-2 p-3 text-left transition ${
                active
                  ? "border-[var(--accent)] bg-[var(--surface)]"
                  : "border-[var(--border)] bg-[var(--surface)]/60 hover:border-[var(--border-strong)]"
              }`}
            >
              <div data-theme={t.id} className="overflow-hidden rounded-md">
                <TemplateThumb config={t.config} />
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold">
                  {t.name}
                  {active && (
                    <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--accent-fg)]">
                      Activa
                    </span>
                  )}
                </p>
                {!compacto && (
                  <p className="mt-0.5 text-xs leading-snug text-[var(--fg-muted)]">
                    {t.description}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {!activeId && (
        <p className="meta">Disposición personalizada (no coincide con ninguna plantilla). Elige una para partir de cero.</p>
      )}
    </div>
  );
}

/** Diagrama en miniatura de cómo se organiza cada plantilla. */
function TemplateThumb({ config }: { config: Layout }) {
  const ink = "bg-[color-mix(in_srgb,var(--ink-faint)_40%,transparent)]";
  const brand = "bg-[color-mix(in_srgb,var(--brand)_35%,transparent)]";

  if (config.templateId === "vanguardia") {
    return (
      <div className="grid h-16 grid-cols-6 grid-rows-2 gap-1 rounded-md bg-[#0a0b0d] p-1.5">
        <div className="col-span-4 row-span-2 rounded-[0.4rem] bg-[color-mix(in_srgb,var(--brand)_45%,#1a1b20)]" />
        <div className="col-span-2 row-span-2 rounded-[0.4rem] bg-[#22c55e]/40" />
      </div>
    );
  }

  if (config.templateId === "revista") {
    return (
      <div className="flex h-16 flex-col gap-1 rounded-md bg-[var(--paper-2)] p-1.5">
        <div className={cn("relative h-9 w-full rounded-sm", ink)}>
          <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
            <span className="h-1 w-2.5 rounded-full bg-white/90" />
            <span className="h-1 w-1 rounded-full bg-white/50" />
            <span className="h-1 w-1 rounded-full bg-white/50" />
          </div>
        </div>
        <div className="flex flex-1 gap-1">
          {Array.from({ length: config.breveColumns }).map((_, i) => (
            <div key={i} className={cn("flex-1 rounded-sm", brand)} />
          ))}
        </div>
      </div>
    );
  }

  if (config.templateId === "compacto") {
    return (
      <div className="grid h-16 grid-cols-4 grid-rows-2 gap-1 rounded-md bg-[var(--paper-2)] p-1.5">
        <div className={cn("col-span-2 row-span-2 rounded-sm", ink)} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn("rounded-sm", brand)} />
        ))}
      </div>
    );
  }

  const horizontal = config.breveDirection === "horizontal";
  return (
    <div className="flex h-16 gap-1 rounded-md bg-[var(--paper-2)] p-1.5">
      {horizontal ? (
        <div className="flex w-full flex-col gap-1">
          <div className={cn("h-8 w-full rounded-sm", ink)} />
          <div className="flex flex-1 gap-1">
            {Array.from({ length: config.breveColumns }).map((_, i) => (
              <div key={i} className={cn("flex-1 rounded-sm", brand)} />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className={cn("h-full w-[62%] rounded-sm", ink)} />
          <div className="flex h-full flex-1 flex-col gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={cn("flex-1 rounded-sm", brand)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionSettings({
  layout,
  onChange,
}: {
  layout: Layout;
  onChange: (p: Partial<Layout>) => void;
}) {
  const horizontal = layout.breveDirection === "horizontal";
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="meta mb-1.5">“En breve”</p>
        <div className="flex gap-1.5">
          <SegButton active={!horizontal} onClick={() => onChange({ breveDirection: "vertical" })}>
            <Rows3 size={13} /> Vertical
          </SegButton>
          <SegButton active={horizontal} onClick={() => onChange({ breveDirection: "horizontal" })}>
            <LayoutGrid size={13} /> Horizontal
          </SegButton>
        </div>
      </div>

      {horizontal && (
        <div>
          <p className="meta mb-1.5">Columnas de “En breve”</p>
          <div className="flex gap-1.5">
            {[2, 3, 4].map((n) => (
              <SegButton key={n} active={layout.breveColumns === n} onClick={() => onChange({ breveColumns: n })}>
                {n}
              </SegButton>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="meta mb-1.5">Columnas de “Lo más reciente”</p>
        <div className="flex gap-1.5">
          {[2, 3, 4].map((n) => (
            <SegButton key={n} active={layout.riverColumns === n} onClick={() => onChange({ riverColumns: n })}>
              {n}
            </SegButton>
          ))}
        </div>
      </div>

      <BackgroundSettings
        value={layout.background ?? { mode: "theme" }}
        onChange={(background) => onChange({ background })}
      />
    </div>
  );
}

/**
 * Fondo de la plantilla: heredado del tema, un color sólido o un degradado.
 * Disponible en las cinco plantillas — los colores del texto se recalculan
 * solos a partir de la luminancia del fondo (ver src/lib/home-background.ts),
 * así que ninguna combinación deja titulares ilegibles.
 */
function BackgroundSettings({
  value,
  onChange,
}: {
  value: HomeBackground;
  onChange: (b: HomeBackground) => void;
}) {
  const from = value.from ?? "#0d1117";
  const to = value.to ?? "#1f2937";
  const angle = value.angle ?? 160;

  return (
    <div className="border-t border-[var(--rule)] pt-4">
      <p className="meta mb-1.5">Fondo de la plantilla</p>
      <div className="flex gap-1.5">
        <SegButton active={value.mode === "theme"} onClick={() => onChange({ mode: "theme" })}>
          Tema
        </SegButton>
        <SegButton
          active={value.mode === "solid"}
          onClick={() => onChange({ mode: "solid", from, to, angle })}
        >
          Sólido
        </SegButton>
        <SegButton
          active={value.mode === "gradient"}
          onClick={() => onChange({ mode: "gradient", from, to, angle })}
        >
          Degradado
        </SegButton>
      </div>

      {value.mode !== "theme" && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <label className="meta flex items-center gap-2">
              <input
                type="color"
                value={from}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
                className="size-8 cursor-pointer rounded border border-[var(--rule)] bg-transparent p-0.5"
                aria-label="Color base"
              />
              {value.mode === "gradient" ? "Desde" : "Color"}
            </label>
            {value.mode === "gradient" && (
              <label className="meta flex items-center gap-2">
                <input
                  type="color"
                  value={to}
                  onChange={(e) => onChange({ ...value, to: e.target.value })}
                  className="size-8 cursor-pointer rounded border border-[var(--rule)] bg-transparent p-0.5"
                  aria-label="Color final"
                />
                Hasta
              </label>
            )}
            <span
              aria-hidden
              className="ml-auto h-8 w-16 rounded border border-[var(--rule)]"
              style={{
                background:
                  value.mode === "gradient"
                    ? `linear-gradient(${angle}deg, ${from}, ${to})`
                    : from,
              }}
            />
          </div>

          {value.mode === "gradient" && (
            <label className="meta flex items-center gap-3">
              Ángulo
              <input
                type="range"
                min={0}
                max={360}
                step={5}
                value={angle}
                onChange={(e) => onChange({ ...value, angle: Number(e.target.value) })}
                className="flex-1 accent-[var(--brand)]"
              />
              <span className="tabular-nums">{angle}°</span>
            </label>
          )}

          <div className="flex flex-wrap gap-1.5">
            {BACKGROUND_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange(preset.value)}
                title={preset.label}
                className="size-7 rounded-full border border-[var(--rule)] transition hover:scale-110"
                style={{
                  background:
                    preset.value.mode === "gradient"
                      ? `linear-gradient(${preset.value.angle ?? 160}deg, ${preset.value.from}, ${preset.value.to})`
                      : preset.value.from,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Inspector({
  item,
  showSpan,
  onChange,
  onClear,
  onClose,
}: {
  item: Item;
  showSpan: boolean;
  onChange: (p: Partial<HomeStyle>) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const s = item.homeStyle ?? {};
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-xs font-semibold">{item.title}</p>
        <button
          onClick={onClose}
          className="shrink-0 rounded-full p-1 text-[var(--fg-muted)] transition hover:text-[var(--accent)]"
          title="Deseleccionar"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="meta mb-1.5 flex items-center gap-1"><Type size={12} /> Tamaño de bloque</p>
          <div className="flex gap-1.5">
            <SegButton active={!s.size} onClick={() => onChange({ size: undefined })}>Auto</SegButton>
            <SegButton active={s.size === "sm"} onClick={() => onChange({ size: "sm" })}>S</SegButton>
            <SegButton active={s.size === "md"} onClick={() => onChange({ size: "md" })}>M</SegButton>
            <SegButton active={s.size === "lg"} onClick={() => onChange({ size: "lg" })}>L</SegButton>
          </div>
        </div>

        <div className="sm:col-span-2">
          <p className="meta mb-1.5">Tipo de letra del titular</p>
          <FontPicker value={s.font} onChange={(font) => onChange({ font })} />
        </div>

        <div className="sm:col-span-2">
          <p className="meta mb-1.5 flex items-center gap-1">
            <Palette size={12} /> Color del titular
          </p>
          <ColorPicker value={s.color} onChange={(color) => onChange({ color })} />
        </div>

        <div>
          <p className="meta mb-1.5">Estilo del titular</p>
          <div className="flex gap-1.5">
            <SegButton active={!!s.bold} onClick={() => onChange({ bold: !s.bold || undefined })} title="Negrilla">
              <Bold size={13} />
            </SegButton>
            <SegButton active={!!s.italic} onClick={() => onChange({ italic: !s.italic || undefined })} title="Cursiva">
              <Italic size={13} />
            </SegButton>
          </div>
        </div>

        {showSpan && (
          <div>
            <p className="meta mb-1.5 flex items-center gap-1"><Columns2 size={12} /> Ancho en la cuadrícula</p>
            <div className="flex gap-1.5">
              <SegButton active={s.span !== 2} onClick={() => onChange({ span: undefined })}>1 columna</SegButton>
              <SegButton active={s.span === 2} onClick={() => onChange({ span: 2 })}>2 columnas</SegButton>
            </div>
          </div>
        )}

        <div>
          <p className="meta mb-1.5">
            Escala del titular — <span className="font-semibold text-[var(--fg)]">{s.titleScale ?? 100}%</span>
          </p>
          <input
            type="range"
            min={70}
            max={160}
            step={5}
            value={s.titleScale ?? 100}
            onChange={(e) => onChange({ titleScale: Number(e.target.value) === 100 ? undefined : Number(e.target.value) })}
            className="w-full accent-[var(--brand)]"
          />
        </div>

        <div>
          <p className="meta mb-1.5 flex items-center gap-1">
            <ImageIcon size={12} /> Tamaño de imagen —{" "}
            <span className="font-semibold text-[var(--fg)]">{s.imageScale ?? 100}%</span>
          </p>
          <input
            type="range"
            min={40}
            max={100}
            step={5}
            value={s.imageScale ?? 100}
            onChange={(e) => onChange({ imageScale: Number(e.target.value) === 100 ? undefined : Number(e.target.value) })}
            className="w-full accent-[var(--brand)]"
          />
        </div>
      </div>

      <button onClick={onClear} className="self-start text-xs font-medium text-[var(--ink-faint)] hover:text-[var(--danger)]">
        Quitar todo el estilo de esta tarjeta
      </button>
    </div>
  );
}
