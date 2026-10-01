"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bold,
  ExternalLink,
  ChevronDown,
  Columns2,
  Palette,
  Image as ImageIcon,
  Italic,
  LayoutGrid,
  Megaphone,
  Monitor,
  Paintbrush,
  MessageSquare,
  Layers,
  ListTree,
  RotateCcw,
  Save,
  Smartphone,
  Tablet,
  Type,
  X,
} from "lucide-react";
import { AdsEditor } from "@/components/panel/ads-editor";
import type { AdDraft } from "@/components/panel/ads-zone-form";
import type { AdsZoneRow } from "@/lib/ads";
import {
  saveHomeLayout,
  resetHomeLayout,
  saveHomeSectionLayout,
  saveHomeDraft,
  type HomeLayoutEntry,
} from "@/app/panel/(app)/portada/actions";
import type { ArticleListItem } from "@/lib/content";
import type { HomeLayoutConfig, HomeStyle } from "@/db/schema";
import { HOME_TEMPLATES } from "@/lib/home-layout";
import type { RegionId } from "@/lib/home-regions";
import type { SectionElId } from "@/db/schema";
import { SectionPanel } from "@/components/panel/section-panel";
import { TemplateBlueprint, type AdState } from "@/components/panel/template-blueprint";
import type { AdPosition } from "@/lib/ads-positions";
import { SectionFiltersPicker } from "@/components/panel/section-filters-picker";
import { SeccionForm } from "@/components/panel/seccion-form";
import { SectionTree, type SectionNode } from "@/components/panel/section-tree";
import { RegionEditor } from "@/components/panel/region-editor";
import { PartsEditor } from "@/components/panel/parts-editor";
import { PopupEditor } from "@/components/panel/popup-editor";
import { PreviewFrame } from "@/components/panel/preview-frame";
import type { PopupConfig } from "@/lib/popup-types";
import { ACCEPTED_KEY, DRAFT_PING_KEY, LAYOUT_EDIT_KEY, SECCIONES_KEY, type PortadaDraft } from "@/lib/portada-draft";
import type { FooterId, NavbarId } from "@/lib/template-parts";
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
  initialPopup,
  adsZones,
  sections,
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
  /** Popup del portal guardado. */
  initialPopup: PopupConfig;
  /** Un navbar renderizado por cada pieza (NAVBARS). */
  headerVariants: Record<NavbarId, React.ReactNode>;
  /** El pie también cambia con la plantilla, igual que la cabecera. */
  /** Un footer renderizado por cada pieza (FOOTERS). */
  footerVariants: Record<FooterId, React.ReactNode>;
  /** Las 7 zonas de pauta, gestionables sin salir del editor de portada. */
  adsZones: AdsZoneRow[];
  /** Secciones del menú, para editarlas cuando el lienzo muestra una. */
  sections: SectionNode[];
  canManagePauta: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [region, setRegion] = useState<RegionId>("navbar");
  const [popup, setPopup] = useState<PopupConfig>(initialPopup);
  const [popupPreview, setPopupPreview] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [frameNonce, setFrameNonce] = useState(0);
  const frameDoc = useRef<Document | null>(null);
  const regionRef = useRef<RegionId>("navbar");
  const [secEl, setSecEl] = useState<SectionElId>("title");
  const secElRef = useRef<SectionElId>("title");
  const inSectionRef = useRef(false);
  const [previewPath, setPreviewPath] = useState("/vista-portada");
  const seccion = previewPath.startsWith("/vista-portada/categoria/")
    ? (sections.find((x) => x.slug === previewPath.split("/").pop()) ?? null)
    : null;
  const selectedRef = useRef<number | null>(null);
  // Anuncios: lo que se escribe (sin guardar) y cuál se está editando, para verlo en el lienzo.
  const [adDrafts, setAdDrafts] = useState<Record<string, AdDraft>>({});
  const [adFocus, setAdFocus] = useState<string | null>(null);
  const [adRequest, setAdRequest] = useState<{ key: string; n: number } | null>(null);
  // Estado de cada posición para el plano: activo > borrador > vacío (con lo que se está escribiendo).
  const adStates: Partial<Record<AdPosition, AdState>> = {};
  for (const z of adsZones) {
    const d = adDrafts[z.key];
    const image = d ? d.imageUrl : (z.imageUrl ?? "");
    const html = d ? d.html : (z.html ?? "");
    const active = d ? d.active : z.active;
    const has = /^https?:\/\//i.test(image) || !!html;
    const st: AdState = has && active ? "activo" : has ? "borrador" : "vacio";
    const cur = adStates[z.position];
    if (!cur || st === "activo" || (st === "borrador" && cur === "vacio")) adStates[z.position] = st;
  }
  // "template": elegir la plantilla. "content": la página real, editable —
  // clic para estilo, arrastrar para reordenar. La disposición de secciones
  // (columnas, dirección de "En breve") se ajusta desde "content" también,
  // como un panel flotante — es una decisión de contenido, no de plantilla.
  const [viewport, setViewport] = useState<"escritorio" | "tablet" | "movil">("escritorio");

  const initialItemsSerialized = useMemo(() => serializeItems(initialItems), [initialItems]);
  const initialLayoutSerialized = useMemo(() => JSON.stringify(initialLayout), [initialLayout]);
  const dirty = serializeItems(items) !== initialItemsSerialized || JSON.stringify(layout) !== initialLayoutSerialized;

  // Borrador de diseño: se guarda en el servidor (con un pequeño retraso) cada
  // vez que cambia algo. Lo lee la portada real que se enseña en el lienzo y en
  // la pestaña «Vista previa». Tras guardar, el lienzo se recarga y se avisa a
  // la otra pestaña. El primer guardado es inmediato y desbloquea el lienzo,
  // para no enseñar un borrador viejo de una sesión anterior.
  const firstDraft = useRef(true);
  useEffect(() => {
    const draft: PortadaDraft = {
      layout,
      items: items.map((i) => ({ slug: i.slug, homeStyle: i.homeStyle ?? null })),
      popup,
      adDrafts,
    };
    const isFirst = firstDraft.current;
    firstDraft.current = false;
    const save = async () => {
      try {
        await saveHomeDraft(draft);
        localStorage.setItem(DRAFT_PING_KEY, String(Date.now()));
      } catch {
        /* sin permiso o sin conexión: el lienzo mostrará lo último guardado */
      } finally {
        setDraftReady(true);
        if (!isFirst) setFrameNonce((n) => n + 1);
      }
    };
    if (isFirst) {
      void save();
      return;
    }
    const id = setTimeout(() => void save(), 700);
    return () => clearTimeout(id);
  }, [layout, items, popup, adDrafts]);

  // Marca en la portada real el componente y la tarjeta que se están editando.
  function paintSelection() {
    const st = frameDoc.current?.getElementById("cg-sel");
    if (!st) return;
    const r = regionRef.current;
    const c = selectedRef.current;
    const e = secElRef.current;
    st.textContent =
      `[data-region="${r}"]{outline:2px dashed #84a21f;outline-offset:-2px}` +
      (r === "encabezado" ? `[data-el="${e}"]{outline:2px solid #84a21f;outline-offset:3px}` : "") +
      (c !== null ? `[data-card-index="${c}"]{outline:3px solid #84a21f;outline-offset:2px}` : "");
  }
  useEffect(() => {
    regionRef.current = region;
    secElRef.current = secEl;
    inSectionRef.current = previewPath.startsWith("/vista-portada/categoria/");
    selectedRef.current = selected;
    paintSelection();
  });

  // Se llama cada vez que carga la portada real del lienzo.
  function hookFrame(doc: Document) {
    frameDoc.current = doc;
    if (!doc.getElementById("cg-sel")) {
      const st = doc.createElement("style");
      st.id = "cg-sel";
      doc.head.appendChild(st);
    }
    paintSelection();
    // Clic en un componente o una tarjeta: se selecciona para editarlo. Los
    // enlaces no navegan (llevarían fuera del borrador).
    doc.addEventListener(
      "click",
      (e) => {
        const el = e.target as HTMLElement;
        const link = el.closest("a");
        if (link) e.preventDefault();
        // Opción del menú o enlace interno: el lienzo muestra esa página (con el
        // borrador aplicado) para verla y ajustar su navbar, cuerpo y pie.
        if (link) {
          const url = new URL(link.href, "https://x.invalid");
          const sec = url.pathname.match(/^\/(?:en\/)?categoria\/([^/]+)\/?$/);
          if (sec) {
            setPreviewPath(`/vista-portada/categoria/${sec[1]}`);
            return;
          }
          if (url.pathname === "/" || url.pathname === "/en") {
            setPreviewPath("/vista-portada");
            return;
          }
        }
        // Pieza suelta del encabezado de una sección (migas, título…): abre su editor.
        const piece = el.closest("[data-el]")?.getAttribute("data-el") as SectionElId | null;
        if (piece) {
          setSecEl(piece);
          setRegion("encabezado");
          return;
        }
        const card = el.closest("[data-card-index]")?.getAttribute("data-card-index");
        if (card !== null && card !== undefined) setSelected(Number(card));
        const r = el.closest("[data-region]")?.getAttribute("data-region") as RegionId | null;
        // En una sección solo hay dos piezas editables: encabezado y cuerpo.
        if (r && (!inSectionRef.current || r === "encabezado" || r === "body")) setRegion(r);
      },
      true,
    );
  }

  // Si en la pestaña de vista previa se aceptó y publicó el diseño, se
  // recarga para partir de lo guardado (y «Cambios sin guardar» desaparece).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACCEPTED_KEY) router.refresh();
      // Otra pestaña (la vista previa) cambió una sección: se recarga el árbol y el lienzo.
      if (e.key === SECCIONES_KEY) {
        setFrameNonce((n) => n + 1);
        router.refresh();
      }
      if (e.key === LAYOUT_EDIT_KEY && e.newValue) {
        try {
          setLayout(JSON.parse(e.newValue) as Layout);
          setSaved(false);
        } catch {
          /* ignorado */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [router]);

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

  // Dispositivo de la vista previa: pantalla real de iPhone, iPad o Mac.
  const device = ({ escritorio: "mac", tablet: "ipad", movil: "iphone" } as const)[viewport];

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
      {/* ------------------------------------------------------- Lienzo */}
      <div className="flex min-w-0 flex-col gap-3">
        <div
          data-theme="panel-ui"
          className="sticky z-30 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[var(--fg)] shadow-[var(--shadow)]"
          style={{ top: "calc(var(--panel-header-h, 0px) + 0.75rem)" }}
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
                ["escritorio", Monitor, "Mac"],
                ["tablet", Tablet, "iPad"],
                ["movil", Smartphone, "iPhone"],
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

          {previewPath !== "/vista-portada" && (
            <>
              <button
                type="button"
                onClick={() => setPreviewPath("/vista-portada")}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3.5 py-2 text-xs font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                ← Inicio
              </button>
              <a
                href={`/panel/secciones?abrir=${previewPath.split("/").pop()}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3.5 py-2 text-xs font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                Nombre y descripción de la sección
              </a>
            </>
          )}
          <button
            type="button"
            onClick={() => window.open("/panel/portada?vista=1", "_blank")}
            title="Abre esta vista previa a tamaño real en otra pestaña; se actualiza sola mientras editas"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3.5 py-2 text-xs font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <ExternalLink size={13} />
            Vista previa en pestaña nueva
          </button>

          <span className="ml-auto text-xs text-[var(--fg-muted)]">
            {dirty ? (
              <span className="font-semibold text-[var(--fg)]">Cambios sin guardar</span>
            ) : saved ? (
              <span className="font-semibold text-[var(--accent-2)]">Guardado ✓</span>
            ) : (
              "Pulsa un componente o una tarjeta para editarlo"
            )}
          </span>
        </div>

        {/* Marco del lienzo: la portada real, a escala de su ancho elegido. */}
        <div
          className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-2)] p-3 shadow-[var(--shadow)]"
        >
          <div className="h-[calc(100dvh-13rem)] min-h-[30rem]">
          {draftReady ? (
            <PreviewFrame
              key="real"
              device={device}
              src={`${previewPath}?popup=${popupPreview ? 1 : 0}&n=${frameNonce}`}
              onFrameLoad={hookFrame}
            />
          ) : (
            <div className="grid h-full place-items-center text-sm text-[var(--fg-muted)]">Preparando la vista real…</div>
          )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------ Controles */}
      <aside
        data-theme="panel-ui"
        className="flex flex-col gap-3 text-[var(--fg)] xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto xl:pr-1"
      >
        {seccion ? (
          <>
            <Bloque titulo={`Sección · ${seccion.name}`} icono={<LayoutGrid size={13} />}>
              <p className="mb-3 text-xs leading-relaxed text-[var(--fg-muted)]">
                Nombre, descripción y orden en el menú. Se guardan al pulsar Guardar en este bloque.
              </p>
              <SeccionForm key={`${seccion.id}:${seccion.sortOrder}`} id={seccion.id} slug={seccion.slug} name={seccion.name} description={seccion.description} sortOrder={seccion.sortOrder} articleCount={seccion.articleCount} defaultOpen onSaved={() => setFrameNonce((n) => n + 1)} />
            </Bloque>
            <Bloque titulo="Encabezado y cuerpo" icono={<Paintbrush size={13} />}>
              <SectionPanel layout={layout} onChange={patchLayout} region={region} onRegion={setRegion} el={secEl} onEl={setSecEl} />
              <p className="mt-4 text-xs leading-relaxed text-[var(--fg-muted)]">
                Pulsa una pieza en la página para editarla. Se aplica a todas las secciones y plantillas, y se publica con «Guardar diseño».
              </p>
            </Bloque>
            <Bloque titulo="Publicidad de secciones" icono={<Megaphone size={13} />}>
              <AdsEditor
                zones={adsZones.filter((z) => z.position.startsWith("section"))}
                canManage={canManagePauta}
                onDraft={(key, draft) => setAdDrafts((d) => ({ ...d, [key]: draft }))}
                onFocusZone={setAdFocus}
              />
            </Bloque>
          </>
        ) : (
          <>
        <Bloque titulo="Plantilla" icono={<LayoutGrid size={13} />}>
          <TemplatePicker layout={layout} onPick={(config) => patchLayout({ ...config, parts: {}, sectionFilters: layout.sectionFilters })} compacto />
          {/* Crear plantilla desde cero, dentro del mismo bloque. */}
          <details className="group/crear mt-4 rounded-[var(--radius)] border border-[var(--border)]">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold">
              <Layers size={14} className="text-[var(--accent)]" /> Crear plantilla desde cero
              <ChevronDown size={14} className="ml-auto transition-transform group-open/crear:rotate-180" />
            </summary>
            <div className="border-t border-[var(--border)] p-3">
              <PartsEditor layout={layout} onChange={patchLayout} />
            </div>
          </details>
        </Bloque>

        <Bloque titulo="Componentes" icono={<Paintbrush size={13} />}>
          {/* Tarjeta concreta del lienzo: sus ajustes individuales van dentro
              de Componentes, encima de los generales de cada pieza. */}
          {selected !== null && items[selected] && (
            <div className="mb-5 rounded-[var(--radius)] border border-[var(--accent)] p-3">
              <p className="meta mb-2 !text-[0.65rem]">Tarjeta #{selected + 1} seleccionada</p>
              <Inspector
                item={items[selected]}
                showSpan={selected >= 6}
                onChange={(p) => patchStyle(selected, p)}
                onClear={() => patchStyle(selected, null)}
                onClose={() => setSelected(null)}
              />
            </div>
          )}
          <RegionEditor
            value={layout.regions ?? {}}
            active={region}
            onActive={setRegion}
            onChange={(regions) => patchLayout({ regions })}
            only={["navbar", "hero", "cards", "body", "footer"]}
          />
          {selected === null && (
            <p className="mt-4 text-xs leading-relaxed text-[var(--fg-muted)]">
              Para cambiar una sola noticia, haz clic en su tarjeta del lienzo. Arrástrala para
              cambiar su posición en la portada.
            </p>
          )}
        </Bloque>

        <Bloque titulo="Secciones" icono={<ListTree size={13} />}>
          <p className="mb-3 text-xs leading-relaxed text-[var(--fg-muted)]">
            Así cuelga cada sección del menú. Pulsa una para ver de cuál depende y editar su nombre, descripción y orden.
          </p>
          <SectionTree
            sections={sections}
            onSaved={() => {
              setFrameNonce((n) => n + 1);
              router.refresh();
            }}
          />
        </Bloque>

        {/* Las mismas zonas que en Configuración › Publicidad, aquí también, con un
            plano de la plantilla que muestra dónde cae cada una, y el popup. */}
        <Bloque titulo="Publicidad y popup" icono={<Megaphone size={13} />}>
          <details
            className="rounded-[var(--radius)] border border-[var(--border)]"
            onToggle={(e) => {
              if (!(e.currentTarget as HTMLDetailsElement).open) setAdFocus(null);
            }}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold">
              <Megaphone size={14} className="text-[var(--accent)]" /> Publicidad
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[0.65rem] font-bold text-[var(--fg-muted)]">
                {Object.values(adStates).filter((v) => v === "activo").length} activos
              </span>
              <ChevronDown size={14} className="ml-auto" />
            </summary>
            <div className="border-t border-[var(--border)] p-3">
              <TemplateBlueprint
                layout={layout}
                adStates={adStates}
                focus={(adFocus ? (adFocus.split("__")[0] as AdPosition) : null)}
                onPick={(pos) => {
                  setAdFocus(pos);
                  setAdRequest((r) => ({ key: pos, n: (r?.n ?? 0) + 1 }));
                }}
              />
              <div className="mt-5">
                <AdsEditor
                  zones={adsZones}
                  canManage={canManagePauta}
                  onDraft={(key, draft) => setAdDrafts((d) => ({ ...d, [key]: draft }))}
                  onFocusZone={setAdFocus}
                  request={adRequest}
                />
              </div>
            </div>
          </details>
          <details
            className="mt-3 rounded-[var(--radius)] border border-[var(--border)]"
            onToggle={(e) => setPopupPreview((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold">
              <MessageSquare size={14} className="text-[var(--accent)]" /> Popup del sitio
              <ChevronDown size={14} className="ml-auto" />
            </summary>
            <div className="border-t border-[var(--border)] p-3">
              <PopupEditor
                value={popup}
                // Cada cambio se ve al instante: el popup aparece en el lienzo.
                onChange={(p) => {
                  setPopup(p);
                  setPopupPreview(true);
                }}
                previewing={popupPreview}
                onPreview={setPopupPreview}
              />
            </div>
          </details>
        </Bloque>
          </>
        )}
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
  onToggle,
}: {
  titulo: string;
  icono: React.ReactNode;
  children: React.ReactNode;
  /** Estado inicial; después manda el usuario. Por defecto, plegado. */
  abierto?: boolean;
  /** Avisa al abrir/cerrar (p. ej. mostrar el popup en el lienzo). */
  onToggle?: (open: boolean) => void;
}) {
  return (
    <details
      open={abierto}
      onToggle={(e) => onToggle?.((e.currentTarget as HTMLDetailsElement).open)}
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

export function TemplatePicker({
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
