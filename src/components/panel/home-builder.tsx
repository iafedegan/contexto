"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutGrid, Layers, ListOrdered, ListTree, Megaphone, MessageSquare, SlidersHorizontal } from "lucide-react";
import type { AdDraft } from "@/components/panel/ads-zone-form";
import type { AdsZoneRow } from "@/lib/ads";
import { publishHomeDraft, restoreHomeSnapshot, saveHomeDraft } from "@/app/panel/(app)/portada/actions";
import type { HomeStyle, SectionElId, ZoneStyle } from "@/db/schema";
import { DEFAULT_HOME_LAYOUT, HOME_TEMPLATES } from "@/lib/home-layout";
import { REGIONS, type RegionId, type RegionStyles } from "@/lib/home-regions";
import { SECTION_ELS } from "@/lib/section-els";
import { enhanceBlocks, measureZone, type ZoneMapData } from "@/lib/block-tools";
import { installCanvasHints, type HintLabels } from "@/lib/canvas-hints";
import { countChanges, summarizeChanges, type PortadaState } from "@/lib/portada-summary";
import { SectionPanel } from "@/components/panel/section-panel";
import type { ZoneBundle } from "@/components/panel/block-style-editor";
import { AdsPanel } from "@/components/panel/ads-panel";
import { SeccionForm } from "@/components/panel/seccion-form";
import { SectionTree, type SectionNode } from "@/components/panel/section-tree";
import { PartsEditor } from "@/components/panel/parts-editor";
import { PopupEditor } from "@/components/panel/popup-editor";
import { PreviewFrame, type Zoom } from "@/components/panel/preview-frame";
import { PortadaToolbar, type Viewport } from "@/components/panel/portada-toolbar";
import { PortadaToast, type ToastData } from "@/components/panel/portada-toast";
import { PropiedadesCard, type Foco } from "@/components/panel/propiedades-card";
import { NotasLista } from "@/components/panel/notas-lista";
import { PortadaGuia } from "@/components/panel/portada-guia";
import { TemplatePicker } from "@/components/panel/portada-controls";
import { usePortadaHistory, type EditorSnap } from "@/components/panel/use-portada-history";
import type { PopupConfig } from "@/lib/popup-types";
import { ACCEPTED_KEY, DRAFT_PING_KEY, ADS_EDIT_KEY, ITEMS_EDIT_KEY, LAYOUT_EDIT_KEY, SECCIONES_KEY, type PortadaDraft } from "@/lib/portada-draft";
import type { Anterior, Item, Layout } from "@/components/panel/portada-types";
import { recortar } from "@/lib/format";

// Clave donde se recuerda que ya se mostró la guía.
const GUIA_KEY = "cg:portada-guia-v1";
// Clave donde se guarda lo último publicado, para poder deshacer.
const PUBLICADO_KEY = "cg:portada-publicado";
/** Aviso de una sola vez que debe sobrevivir a la recarga de la página (p. ej. «Se volvió a la versión anterior»). */
const AVISO_KEY = "cg:portada-aviso";
/** Cómo se ve el lienzo (zoom, marco, ampliado): se recuerda entre visitas. */
const VISTA_KEY = "cg:portada-vista";

/** «hace 5 min», «hace 2 h»… para el aviso de borrador pendiente. */
function haceCuanto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

// Editor visual de la portada: plantilla, orden y estilo de las notas, secciones, anuncios y ventana emergente, con vista previa real.
export function HomeBuilder({
  initialItems,
  initialLayout,
  initialPopup,
  adsZones,
  sections,
  canManagePauta,
  resume: resumeProp,
}: {
  initialItems: Item[];
  initialLayout: Layout;
  /** Ventana emergente guardada. */
  initialPopup: PopupConfig;
  /** Las zonas de pauta, gestionables sin salir del editor de portada. */
  adsZones: AdsZoneRow[];
  /** Secciones del menú, para editarlas cuando el lienzo muestra una. */
  sections: SectionNode[];
  canManagePauta: boolean;
  /** Borrador sin publicar de una sesión anterior (si lo hay y difiere de lo publicado). */
  resume: { draft: PortadaDraft; at: string; count: number } | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [popup, setPopup] = useState<PopupConfig>(initialPopup);
  const [adDrafts, setAdDrafts] = useState<Record<string, AdDraft>>({});
  /** «Volver al diseño original» pedido: al publicar, las notas vuelven al orden y estilo automáticos. */
  const [auto, setAuto] = useState(false);
  const [resume, setResume] = useState(resumeProp);

  // Qué está elegido en la página.
  const [selected, setSelected] = useState<number | null>(null);
  const [region, setRegion] = useState<RegionId>("navbar");
  const [foco, setFoco] = useState<Foco>(null);
  const [flash, setFlash] = useState(0);
  const [secEl, setSecEl] = useState<SectionElId>("title");

  const [popupPreview, setPopupPreview] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [frameNonce, setFrameNonce] = useState(0);
  const [viewport, setViewport] = useState<Viewport>("escritorio");
  const [zoom, setZoom] = useState<Zoom>("ajustar");
  const [framed, setFramed] = useState(false);
  /** Lienzo ampliado: el menú lateral se oculta y sale como panel flotante con el botón «Opciones». */
  const [ampliado, setAmpliado] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [previewPath, setPreviewPath] = useState("/vista-portada");
  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({});
  const [guia, setGuia] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [lastPub, setLastPub] = useState<{ at: number; prev: Anterior } | null>(null);
  const [zoneMap, setZoneMap] = useState<ZoneMapData | null>(null);
  const [zoneUp, setZoneUp] = useState(0);

  // Refs que leen los manejadores del lienzo (un iframe: sus eventos no se re-crean en cada render).
  const frameDoc = useRef<Document | null>(null);
  const regionRef = useRef<RegionId>("navbar");
  const secElRef = useRef<SectionElId>("title");
  const focoRef = useRef<Foco>(null);
  const inSectionRef = useRef(false);
  const itemsRef = useRef<Item[]>(initialItems);
  const selectedRef = useRef<number | null>(null);
  const patchRef = useRef<(i: number, p: Partial<HomeStyle>) => void>(() => {});
  const moveRef = useRef<(from: number, to: number) => void>(() => {});
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});
  const toastId = useRef(0);

  const seccion = previewPath.startsWith("/vista-portada/categoria/")
    ? (sections.find((x) => x.slug === previewPath.split("/").pop()) ?? null)
    : null;

  const showToast = useCallback((t: Omit<ToastData, "id">) => setToast({ ...t, id: ++toastId.current }), []);
  const closeToast = useCallback(() => setToast(null), []);

  // ---------------------------------------------------------------- Estado y cambios
  const baseState = useMemo<PortadaState>(
    () => ({
      layout: initialLayout,
      items: initialItems.map((i) => ({ slug: i.slug, homeStyle: i.homeStyle ?? null })),
      popup: initialPopup,
      ads: {},
      // Sin ninguna nota fijada a mano, la portada ya es automática.
      auto: initialItems.every((i) => i.homePosition === null),
    }),
    [initialItems, initialLayout, initialPopup],
  );
  const adsBase = useMemo(() => {
    const m: Record<string, AdDraft> = {};
    for (const z of adsZones) {
      m[z.key] = { imageUrl: z.imageUrl ?? "", clickUrl: z.clickUrl ?? "", html: z.html ?? "", active: z.active, startsAt: z.startsAt ? z.startsAt.toISOString() : "", endsAt: z.endsAt ? z.endsAt.toISOString() : "" };
    }
    return m;
  }, [adsZones]);
  const adNames = useMemo(() => Object.fromEntries(adsZones.map((z) => [z.key, z.name])), [adsZones]);
  const titles = useMemo(() => Object.fromEntries(items.map((i) => [i.slug, i.title])), [items]);
  const curState = useMemo<PortadaState>(
    () => ({ layout, items: items.map((i) => ({ slug: i.slug, homeStyle: i.homeStyle ?? null })), popup, ads: adDrafts, auto }),
    [layout, items, popup, adDrafts, auto],
  );
  const changes = useMemo(() => summarizeChanges(baseState, curState, { titles, adsBase, adNames }), [baseState, curState, titles, adsBase, adNames]);
  const count = countChanges(changes);

  // ---------------------------------------------------------------- Deshacer / rehacer
  const applySnap = useCallback((s: EditorSnap) => {
    setItems(s.items);
    setLayout(s.layout);
    setPopup(s.popup);
    setAdDrafts(s.adDrafts);
    setAuto(s.auto);
  }, []);
  const history = usePortadaHistory({ items, layout, popup, adDrafts, auto }, applySnap);

  // ---------------------------------------------------------------- Borrador en el servidor
  // Se guarda (con un pequeño retraso) cada vez que cambia algo. Lo lee la portada
  // real del lienzo y la pestaña «Vista previa». El primer guardado es inmediato y
  // desbloquea el lienzo, para no enseñar un borrador viejo de otra sesión; si hay un
  // borrador pendiente, no se toca hasta que la persona elija qué hacer con él.
  const resumePending = resume !== null;
  const firstDraft = useRef(true);
  useEffect(() => {
    if (resumePending) return;
    const draft: PortadaDraft = {
      layout,
      items: items.map((i) => ({ slug: i.slug, homeStyle: i.homeStyle ?? null })),
      popup,
      adDrafts,
      ...(auto ? { auto: true } : {}),
    };
    const isFirst = firstDraft.current;
    firstDraft.current = false;
    // Guarda el borrador del diseño en el servidor.
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
  }, [layout, items, popup, adDrafts, auto, resumePending]);

  // ---------------------------------------------------------------- Selección en la página
  function focusOn(kind: Foco) {
    setFoco(kind);
    setFlash((n) => n + 1);
    if (inSectionRef.current) setOpenBlocks((o) => ({ ...o, "seccion-diseno": true }));
  }

  /** Marca en la portada real lo que se está editando (solo si hay algo elegido). */
  function paintSelection() {
    const st = frameDoc.current?.getElementById("cg-sel");
    if (!st) return;
    const f = focoRef.current;
    const inSec = inSectionRef.current;
    const r = regionRef.current;
    const c = selectedRef.current;
    const e = secElRef.current;
    let css = "";
    if (f === "parte" || (inSec && f !== null)) {
      css += `[data-region="${r}"]{outline:2px dashed #84a21f;outline-offset:-2px}`;
      if (r === "encabezado") css += `[data-el="${e}"]{outline:2px solid #84a21f;outline-offset:3px}`;
    }
    if (f === "nota" && c !== null) {
      css += `[data-card-index="${c}"]{outline:3px solid #84a21f;outline-offset:2px}`;
      const it = itemsRef.current[c];
      if (it) css += `[data-bs-root="${it.slug}"]:not([data-bslug] *){outline:3px solid #84a21f;outline-offset:2px}`;
    }
    st.textContent = css;
  }
  useEffect(() => {
    regionRef.current = region;
    secElRef.current = secEl;
    focoRef.current = foco;
    inSectionRef.current = previewPath.startsWith("/vista-portada/categoria/");
    itemsRef.current = items;
    patchRef.current = (i, p) => patchStyle(i, p);
    moveRef.current = (from, to) => moveItem(from, to);
    selectedRef.current = selected;
    undoRef.current = () => {
      history.undo();
    };
    redoRef.current = () => {
      history.redo();
    };
    paintSelection();
  });

  /** Etiquetas de las pistas que salen al pasar el ratón por la portada. */
  const hintLabels: HintLabels = {
    region: (id) => (id === "encabezado" ? "Encabezado de la sección" : (REGIONS.find((r) => r.id === id)?.label ?? null)),
    piece: (id) => SECTION_ELS.find((x) => x.id === id)?.label ?? null,
    card: (i) => {
      const it = itemsRef.current[i];
      return it ? `Nota ${i + 1} · ${recortar(it.title, 38)}` : `Nota ${i + 1}`;
    },
    note: (slug) => {
      const it = itemsRef.current.find((x) => x.slug === slug);
      return it ? `Nota · ${recortar(it.title, 38)}` : null;
    },
  };

  // Se llama cada vez que carga la portada real del lienzo.
  function hookFrame(doc: Document) {
    frameDoc.current = doc;
    if (!doc.getElementById("cg-sel")) {
      const st = doc.createElement("style");
      st.id = "cg-sel";
      doc.head.appendChild(st);
    }
    paintSelection();
    // Atajos de deshacer/rehacer también con el foco dentro de la portada.
    doc.addEventListener("keydown", (e) => hotkey(e));
    // Clic en un componente o una tarjeta: se selecciona para editarlo. Los
    // enlaces no navegan (llevarían fuera del borrador).
    doc.addEventListener(
      "click",
      (e) => {
        const el = e.target as HTMLElement;
        const link = el.closest("a");
        if (link) e.preventDefault();
        // Opción del menú o enlace interno: el lienzo muestra esa página (con el
        // borrador aplicado) para verla y ajustar su cabecera, cuerpo y pie.
        if (link) {
          const url = new URL(link.href, "https://x.invalid");
          const sec = url.pathname.match(/^\/(?:en\/)?categoria\/([^/]+)\/?$/);
          if (sec) {
            setFoco(null);
            setPreviewPath(`/vista-portada/categoria/${sec[1]}`);
            return;
          }
          if (url.pathname === "/" || url.pathname === "/en") {
            setFoco(null);
            setPreviewPath("/vista-portada");
            return;
          }
        }
        // Pieza suelta del encabezado de una sección (migas, título…): abre su editor.
        const piece = el.closest("[data-el]")?.getAttribute("data-el") as SectionElId | null;
        if (piece) {
          setSecEl(piece);
          setRegion("encabezado");
          focusOn("parte");
          return;
        }
        let nota = false;
        const card = el.closest("[data-card-index]")?.getAttribute("data-card-index");
        if (card !== null && card !== undefined) {
          setSelected(Number(card));
          nota = true;
        } else {
          // Página de sección: la tarjeta no lleva índice, se busca por su slug.
          const slug = el.closest("[data-bs-root]")?.getAttribute("data-bs-root");
          const idx = slug ? itemsRef.current.findIndex((i) => i.slug === slug) : -1;
          if (idx >= 0) {
            setSelected(idx);
            if (inSectionRef.current) setRegion("body");
            nota = true;
          }
        }
        const r = el.closest("[data-region]")?.getAttribute("data-region") as RegionId | null;
        // En una sección solo hay dos piezas editables: encabezado y cuerpo.
        if (r && (!inSectionRef.current || r === "encabezado" || r === "body")) setRegion(r);
        if (nota) focusOn("nota");
        else if (r && (!inSectionRef.current || r === "encabezado" || r === "body")) focusOn("parte");
      },
      true,
    );
    // Se espera a que la página termine de hidratarse: tocar su DOM antes
    // provocaría errores de hidratación.
    setTimeout(() => {
      if (frameDoc.current !== doc) return;
      enhanceBlocksIn(doc);
      installCanvasHints(doc, hintLabels);
    }, 1800);
  }

  /** Hace el cuerpo ajustable en el lienzo (asas de tamaño y arrastrar para reordenar). */
  function enhanceBlocksIn(doc: Document) {
    enhanceBlocks(doc, doc.body, {
      isCurrent: () => frameDoc.current === doc,
      onResize: (slug, patch) => {
        const idx = itemsRef.current.findIndex((i) => i.slug === slug);
        if (idx >= 0) {
          patchRef.current(idx, patch);
          setSelected(idx);
          focusOn("nota");
        }
      },
      onMove: (from, to) => moveRef.current(from, to),
    });
  }

  // ---------------------------------------------------------------- Otras pestañas
  // Lo que se hace en la vista previa (otra pestaña) llega aquí por localStorage.
  useEffect(() => {
    // Reacciona a los cambios hechos desde la vista previa en otra pestaña.
    const onStorage = (e: StorageEvent) => {
      // Se publicó desde la vista previa: se recarga para partir de lo publicado.
      if (e.key === ACCEPTED_KEY) router.refresh();
      // Otra pestaña cambió una sección: se recarga el árbol y el lienzo.
      if (e.key === SECCIONES_KEY) {
        setFrameNonce((n) => n + 1);
        router.refresh();
      }
      if (e.key === ADS_EDIT_KEY && e.newValue) {
        try {
          setAdDrafts(JSON.parse(e.newValue) as Record<string, AdDraft>);
        } catch {
          /* ignorado */
        }
      }
      // La vista previa reordenó o estiló bloques: se aplica aquí (por slug).
      if (e.key === ITEMS_EDIT_KEY && e.newValue) {
        try {
          const incoming = JSON.parse(e.newValue) as { slug: string; homeStyle: HomeStyle | null }[];
          setItems((prev) => {
            const bySlug = new Map(prev.map((i) => [i.slug, i]));
            const ordered = incoming.flatMap((p) => (bySlug.has(p.slug) ? [{ ...bySlug.get(p.slug)!, homeStyle: p.homeStyle ?? null }] : []));
            const seen = new Set(incoming.map((p) => p.slug));
            return [...ordered, ...prev.filter((i) => !seen.has(i.slug))];
          });
          setAuto(false);
        } catch {
          /* ignorado */
        }
      }
      if (e.key === LAYOUT_EDIT_KEY && e.newValue) {
        try {
          setLayout(JSON.parse(e.newValue) as Layout);
        } catch {
          /* ignorado */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [router]);

  // Mide la zona del bloque elegido cuando el lienzo termina de cargar.
  const selectedSlug = selected !== null ? (items[selected]?.slug ?? null) : null;
  useEffect(() => {
    const id = setTimeout(() => {
      const doc = frameDoc.current;
      if (!doc || !selectedSlug || !/^[\w-]+$/.test(selectedSlug)) return setZoneMap(null);
      const el = doc.querySelector<HTMLElement>(`[data-bslug="${selectedSlug}"]`) ?? doc.querySelector<HTMLElement>(`[data-bs-root="${selectedSlug}"]`);
      setZoneMap(el ? measureZone(el, zoneUp) : null);
    }, 2200);
    return () => clearTimeout(id);
  }, [selectedSlug, frameNonce, previewPath, zoneUp]);

  // ---------------------------------------------------------------- Ediciones
  function setZone(key: string, z: ZoneStyle | undefined) {
    const zones = { ...(layout.zones ?? {}) };
    if (z && Object.keys(z).length) zones[key] = z;
    else delete zones[key];
    patchLayout({ zones });
  }
  // Reúne los datos de las zonas para el editor.
  const zoneBundle = (): ZoneBundle =>
    zoneMap?.key
      ? {
          map: zoneMap,
          style: layout.zones?.[zoneMap.key],
          selectedSlug,
          level: zoneUp,
          onLevel: setZoneUp,
          onChange: (z) => setZone(zoneMap.key!, z),
          onSelect: (it) => {
            const idx = it.slug ? items.findIndex((i) => i.slug === it.slug) : (it.index ?? -1);
            if (idx >= 0) {
              setSelected(idx);
              focusOn("nota");
            }
          },
          onMoveBlock: (it, cell) => {
            const idx = it.slug ? items.findIndex((i) => i.slug === it.slug) : (it.index ?? -1);
            if (idx >= 0) {
              patchStyle(idx, { colStart: cell.col, rowStart: cell.row });
              setSelected(idx);
            }
          },
        }
      : { map: null, style: undefined, onChange: () => {}, onSelect: () => {} };

  // Mueve una nota a otra posición.
  function moveItem(from: number, to: number) {
    if (from === to || to < 0) return;
    setItems((prev) => {
      if (to >= prev.length) return prev;
      const next = prev.slice();
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });
    setSelected(to);
    setAuto(false);
  }

  // Cambia el estilo de una nota.
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
    setAuto(false);
  }

  // Cambia una parte del diseño.
  function patchLayout(partial: Partial<Layout>) {
    setLayout((prev) => ({ ...prev, ...partial }));
  }

  // Elige una plantilla.
  function pickTemplate(config: Layout) {
    const teniaComposicion = Object.values(layout.parts ?? {}).some(Boolean);
    patchLayout({ ...config, parts: {}, sectionFilters: layout.sectionFilters });
    if (teniaComposicion) {
      showToast({
        tone: "info",
        text: "Cambiaste de plantilla: se quitó tu composición personalizada de cabecera, cuerpo y pie.",
        actions: [{ label: "Deshacer", onClick: () => history.undo() }],
        ms: 12000,
      });
    }
  }

  // Selecciona una nota para editarla.
  function selectNota(i: number) {
    setSelected(i);
    focusOn("nota");
    frameDoc.current?.querySelector(`[data-card-index="${i}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // Cierra el panel de edición del elemento enfocado.
  function closeFoco() {
    setFoco(null);
    setSelected(null);
  }

  // ---------------------------------------------------------------- Publicar, descartar, volver
  function snapshotAnterior(): Anterior {
    return {
      auto: baseState.auto ?? false,
      items: initialItems.map((i) => ({ id: i.id, homeStyle: i.homeStyle ?? null })),
      layout: initialLayout,
      popup: initialPopup,
      ads: Object.keys(adDrafts).flatMap((key) => {
        const z = adsZones.find((x) => x.key === key);
        return z
          ? [{ key, html: z.html, imageUrl: z.imageUrl, clickUrl: z.clickUrl, active: z.active, startsAt: z.startsAt ? z.startsAt.toISOString() : null, endsAt: z.endsAt ? z.endsAt.toISOString() : null }]
          : [];
      }),
    };
  }

  // Muestra el aviso de publicación con la opción de deshacer.
  function mostrarPublicado(prev: Anterior, at: number) {
    setLastPub({ at, prev });
    showToast({
      tone: "ok",
      text: "Publicado en el sitio ✓",
      actions: [
        { label: "Ver en el sitio", onClick: () => {}, href: "/" },
        { label: "Deshacer", onClick: () => void deshacerPublicacion(prev) },
      ],
      ms: 20000,
    });
  }

  // Publica el borrador del diseño en el sitio.
  async function publicar(): Promise<{ ok: boolean; message?: string }> {
    const draft: PortadaDraft = {
      layout,
      items: items.map((i) => ({ slug: i.slug, homeStyle: i.homeStyle ?? null })),
      popup,
      adDrafts,
      ...(auto ? { auto: true } : {}),
    };
    // Se guarda lo último que hay en pantalla antes de publicar: lo que se publica es lo que se ve.
    const saved = await saveHomeDraft(draft);
    if (!saved.ok) return { ok: false, message: "No se pudo guardar el borrador antes de publicar." };
    const prev = snapshotAnterior();
    const res = await publishHomeDraft();
    if (!res.ok) return { ok: false, message: res.message };
    const at = Date.now();
    try {
      sessionStorage.setItem(PUBLICADO_KEY, JSON.stringify({ at, prev }));
      localStorage.setItem(ACCEPTED_KEY, String(at));
    } catch {
      /* sin almacenamiento: solo se pierde el aviso tras recargar */
    }
    history.clear();
    mostrarPublicado(prev, at);
    router.refresh();
    return { ok: true };
  }

  // Vuelve a lo que había antes de publicar.
  async function deshacerPublicacion(prev: Anterior) {
    try {
      const res = await restoreHomeSnapshot(prev);
      if (!res.ok) return showToast({ tone: "error", text: res.message, ms: 8000 });
      try {
        sessionStorage.removeItem(PUBLICADO_KEY);
        localStorage.setItem(ACCEPTED_KEY, String(Date.now()));
      } catch {
        /* sin almacenamiento */
      }
      setLastPub(null);
      history.clear();
      const aviso = { at: Date.now(), text: "Se volvió a la versión anterior del sitio ✓" };
      try {
        sessionStorage.setItem(AVISO_KEY, JSON.stringify(aviso));
      } catch {
        /* sin almacenamiento */
      }
      showToast({ tone: "ok", text: aviso.text, ms: 8000 });
      router.refresh();
    } catch {
      showToast({ tone: "error", text: "No se pudo deshacer la publicación. Inténtalo otra vez.", ms: 8000 });
    }
  }

  // Descarta el borrador.
  function descartar() {
    applySnap({ items: initialItems, layout: initialLayout, popup: initialPopup, adDrafts: {}, auto: false });
    closeFoco();
    showToast({
      tone: "info",
      text: "Borrador descartado: la portada vuelve a lo publicado.",
      actions: [{ label: "Deshacer", onClick: () => history.undo() }],
      ms: 12000,
    });
  }

  // Devuelve las notas al orden y estilo automáticos.
  function volverAlOriginal() {
    const ordenadas = [...items]
      .map((i) => ({ ...i, homeStyle: null }))
      .sort((a, b) => (b.publishedAt ? new Date(b.publishedAt).getTime() : 0) - (a.publishedAt ? new Date(a.publishedAt).getTime() : 0));
    applySnap({ items: ordenadas, layout: DEFAULT_HOME_LAYOUT, popup, adDrafts, auto: true });
    closeFoco();
    showToast({
      tone: "info",
      text: "Diseño original cargado como borrador. No se publica solo: revisa y pulsa «Publicar cambios».",
      actions: [{ label: "Deshacer", onClick: () => history.undo() }],
      ms: 15000,
    });
  }

  // ---------------------------------------------------------------- Borrador pendiente
  function retomarBorrador() {
    if (!resume) return;
    const d = resume.draft;
    const bySlug = new Map(initialItems.map((i) => [i.slug, i]));
    const ordenadas = d.items.flatMap((di) => (bySlug.has(di.slug) ? [{ ...bySlug.get(di.slug)!, homeStyle: di.homeStyle }] : []));
    const vistas = new Set(d.items.map((i) => i.slug));
    applySnap({ items: [...ordenadas, ...initialItems.filter((i) => !vistas.has(i.slug))], layout: d.layout, popup: d.popup, adDrafts: d.adDrafts, auto: !!d.auto });
    setResume(null);
  }

  // ---------------------------------------------------------------- Guardas y atajos
  // Con cambios sin publicar, salir (recargar, cerrar, navegar a otra pantalla) pide confirmar.
  useEffect(() => {
    if (count === 0) return;
    // Avisa si hay cambios sin publicar al cerrar la pestaña.
    const antes = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    // Gestiona los clics en la vista previa.
    const clic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const a = (e.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(a.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm("Tienes cambios sin publicar en la portada. Si sales ahora se perderán (quedan como borrador y podrás retomarlos). ¿Salir de todos modos?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", antes);
    document.addEventListener("click", clic, true);
    return () => {
      window.removeEventListener("beforeunload", antes);
      document.removeEventListener("click", clic, true);
    };
  }, [count]);

  /** Cmd/Ctrl+Z deshace; Mayús+Cmd/Ctrl+Z o Ctrl+Y rehace. No pisa el deshacer de los campos de texto. */
  function hotkey(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest?.("input, textarea, select, [contenteditable='true']")) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) {
      e.preventDefault();
      undoRef.current();
    } else if ((k === "z" && e.shiftKey) || k === "y") {
      e.preventDefault();
      redoRef.current();
    }
  }
  useEffect(() => {
    // Atajos de teclado del editor.
    const h = (e: KeyboardEvent) => hotkey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    if (!ampliado || flash === 0) return;
    const id = setTimeout(() => setPanelAbierto(true), 0);
    return () => clearTimeout(id);
  }, [flash, ampliado]);

  // Al montar: ¿acaba de publicarse (la página se recargó)? ¿ya vio la guía?
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(PUBLICADO_KEY);
        if (raw) {
          const v = JSON.parse(raw) as { at: number; prev: Anterior };
          const edad = Date.now() - v.at;
          if (edad < 10 * 60_000) {
            setLastPub(v);
            if (edad < 20_000) mostrarPublicado(v.prev, v.at);
          } else sessionStorage.removeItem(PUBLICADO_KEY);
        }
      } catch {
        /* sin almacenamiento */
      }
      try {
        const raw = sessionStorage.getItem(AVISO_KEY);
        if (raw) {
          sessionStorage.removeItem(AVISO_KEY);
          const v = JSON.parse(raw) as { at: number; text: string };
          if (Date.now() - v.at < 20_000) showToast({ tone: "ok", text: v.text, ms: 8000 });
        }
      } catch {
        /* sin almacenamiento */
      }
      try {
        if (!localStorage.getItem(GUIA_KEY)) setGuia(true);
      } catch {
        /* sin almacenamiento */
      }
      try {
        const v = JSON.parse(localStorage.getItem(VISTA_KEY) ?? "null") as { zoom?: unknown; framed?: unknown; ampliado?: unknown } | null;
        if (v) {
          if (v.zoom === "ajustar" || v.zoom === 0.75 || v.zoom === 1) setZoom(v.zoom);
          setFramed(v.framed === true);
          setAmpliado(v.ampliado === true);
        }
      } catch {
        /* sin almacenamiento */
      }
    }, 0);
    return () => clearTimeout(id);
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambia el zoom, el marco o la ampliación de la vista previa.
  function cambiarVista(next: { zoom?: Zoom; framed?: boolean; ampliado?: boolean }) {
    if (next.zoom !== undefined) setZoom(next.zoom);
    if (next.framed !== undefined) setFramed(next.framed);
    if (next.ampliado !== undefined) {
      setAmpliado(next.ampliado);
      setPanelAbierto(false);
    }
    try {
      localStorage.setItem(VISTA_KEY, JSON.stringify({ zoom, framed, ampliado, ...next }));
    } catch {
      /* sin almacenamiento */
    }
  }

  // Cierra la guía y recuerda que ya se vio.
  function cerrarGuia() {
    setGuia(false);
    try {
      localStorage.setItem(GUIA_KEY, "1");
    } catch {
      /* sin almacenamiento */
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-[var(--fg-muted)]">No hay artículos publicados todavía.</p>;
  }

  // Dispositivo de la vista previa: pantalla real de iPhone, iPad o Mac.
  const device = ({ escritorio: "mac", tablet: "ipad", movil: "iphone" } as const)[viewport];

  // ---------------------------------------------------------------- Resúmenes de los bloques cerrados
  const plantillaActiva = HOME_TEMPLATES.find((t) => t.id === layout.templateId);
  const estiladas = items.filter((i) => i.homeStyle).length;
  const anunciosActivos = adsZones.filter((z) => {
    const d = adDrafts[z.key];
    const image = d ? d.imageUrl : (z.imageUrl ?? "");
    const html = d ? d.html : (z.html ?? "");
    const activo = d ? d.active : z.active;
    return activo && (/^https?:\/\//i.test(image) || !!html);
  }).length;
  const formatoPopup = popup.layout === "modal" ? "ventana centrada" : popup.layout === "banner" ? "franja inferior" : "esquina";

  // Abre o cierra un bloque del panel.
  const toggle = (id: string) => (open: boolean) => setOpenBlocks((o) => ({ ...o, [id]: open }));

  return (
    <div className={ampliado ? "grid gap-5" : "grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]"}>
      {/* ------------------------------------------------------- Lienzo */}
      <div className="flex min-w-0 flex-col gap-3">
        <PortadaToolbar
          changes={changes}
          count={count}
          onPublish={publicar}
          onDiscard={descartar}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onUndo={() => history.undo()}
          onRedo={() => history.redo()}
          viewport={viewport}
          onViewport={setViewport}
          inSection={previewPath !== "/vista-portada"}
          onBackHome={() => {
            setFoco(null);
            setPreviewPath("/vista-portada");
          }}
          onResetOriginal={volverAlOriginal}
          zoom={zoom}
          onZoom={(z) => cambiarVista({ zoom: z })}
          framed={framed}
          onFramed={(v) => cambiarVista({ framed: v })}
          ampliado={ampliado}
          onAmpliado={(v) => cambiarVista({ ampliado: v })}
          onGuide={() => setGuia(true)}
          canUndoPublish={lastPub !== null}
          onUndoPublish={() => lastPub && void deshacerPublicacion(lastPub.prev)}
          disabled={resumePending}
        />

        <p className="xl:hidden rounded-[var(--radius)] bg-[var(--surface-2)] px-3 py-2 text-xs leading-snug text-[var(--fg-muted)]">
          Estás en una pantalla angosta: las opciones quedan debajo de la página. Para editar con comodidad usa un computador.
        </p>

        {/* Marco del lienzo: la portada real, a escala de su ancho elegido. */}
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-2)] p-3 shadow-[var(--shadow)]">
          <div className="h-[calc(100dvh-13rem)] min-h-[30rem]">
            {resume ? (
              <div className="grid h-full place-items-center p-6" data-theme="panel-ui">
                <div className="max-w-md text-center">
                  <p className="text-lg font-bold">Tienes un borrador sin publicar</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
                    Lo dejaste {haceCuanto(resume.at)}, con {resume.count} {resume.count === 1 ? "cambio" : "cambios"} que aún no están en el sitio. ¿Quieres seguir donde lo dejaste?
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    <button type="button" onClick={retomarBorrador} className="inline-flex h-10 items-center rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-fg)]">
                      Retomar mi borrador
                    </button>
                    <button type="button" onClick={() => setResume(null)} className="inline-flex h-10 items-center rounded-full border border-[var(--border-strong)] px-5 text-sm font-semibold">
                      Empezar desde lo publicado
                    </button>
                  </div>
                </div>
              </div>
            ) : draftReady ? (
              <PreviewFrame
                key={`real-${framed ? "marco" : "pagina"}`}
                device={device}
                framed={framed}
                zoom={zoom}
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
        // Mientras se decide qué hacer con un borrador pendiente, el menú no se toca: lo que se cambiara se pisaría al retomar.
        inert={resumePending || undefined}
        className={`flex flex-col gap-3 text-[var(--fg)] ${resumePending ? "opacity-50" : ""} ${
          ampliado
            ? `fixed bottom-[4.75rem] right-4 z-40 max-h-[calc(100dvh-15rem)] w-[23rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[var(--radius-lg)] bg-[var(--bg)] p-2 shadow-2xl ${panelAbierto ? "" : "hidden"}`
            : "xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto xl:pr-1"
        }`}
      >
        {guia && !ampliado && <PortadaGuia onClose={cerrarGuia} />}

        {seccion ? (
          <>
            <Bloque
              id="seccion-datos"
              titulo={`Datos de la sección · ${seccion.name}`}
              resumen="Nombre, descripción y orden en el menú"
              icono={<LayoutGrid size={13} />}
              abierto={!!openBlocks["seccion-datos"]}
              onToggle={toggle("seccion-datos")}
            >
              <p className="mb-3 text-xs leading-relaxed text-[var(--fg-muted)]">
                Estos datos se guardan al pulsar «Guardar» aquí mismo: no forman parte del borrador de diseño.
              </p>
              <SeccionForm key={`${seccion.id}:${seccion.sortOrder}`} id={seccion.id} slug={seccion.slug} name={seccion.name} description={seccion.description} sortOrder={seccion.sortOrder} articleCount={seccion.articleCount} onSaved={() => setFrameNonce((n) => n + 1)} />
            </Bloque>
            <Bloque
              id="seccion-diseno"
              titulo="Diseño de la sección"
              resumen="Encabezado y cuerpo de la página"
              icono={<Layers size={13} />}
              abierto={!!openBlocks["seccion-diseno"]}
              onToggle={toggle("seccion-diseno")}
              destacar={flash}
            >
              <SectionPanel
                layout={layout}
                onChange={patchLayout}
                region={region}
                onRegion={setRegion}
                el={secEl}
                onEl={setSecEl}
                ads={{ zones: adsZones, canManage: canManagePauta, drafts: adDrafts, onDraft: (key, draft) => setAdDrafts((d) => ({ ...d, [key]: draft })) }}
                block={
                  selected !== null && items[selected]
                    ? {
                        title: items[selected].title,
                        style: items[selected].homeStyle ?? {},
                        onChange: (p) => patchStyle(selected, p),
                        onClear: () => patchStyle(selected, null),
                        zone: zoneBundle(),
                      }
                    : null
                }
              />
              <p className="mt-4 text-xs leading-relaxed text-[var(--fg-muted)]">
                Pulsa una pieza en la página para editarla. Se aplica a todas las secciones y plantillas, y se publica con «Publicar cambios».
              </p>
            </Bloque>
          </>
        ) : (
          <>
            <PropiedadesCard
              foco={foco}
              onFoco={(f) => {
                setFoco(f);
                setFlash((n) => n + 1);
              }}
              region={region}
              onRegion={setRegion}
              layout={layout}
              onRegions={(regions: RegionStyles) => patchLayout({ regions })}
              nota={selected !== null && items[selected] ? { index: selected, title: items[selected].title, style: items[selected].homeStyle ?? {} } : null}
              onNotaChange={(p) => selected !== null && patchStyle(selected, p)}
              onNotaClear={() => selected !== null && patchStyle(selected, null)}
              zone={zoneBundle()}
              onClose={closeFoco}
              flash={flash}
            />

            <Bloque
              id="plantilla"
              titulo="Plantilla"
              resumen={plantillaActiva ? `${plantillaActiva.name} · activa` : "Disposición personalizada"}
              icono={<LayoutGrid size={13} />}
              abierto={!!openBlocks.plantilla}
              onToggle={toggle("plantilla")}
            >
              <TemplatePicker layout={layout} onPick={pickTemplate} compacto />
              {/* Crear plantilla desde cero, dentro del mismo bloque. */}
              <details className="group/crear mt-4 rounded-[var(--radius)] border border-[var(--border)]">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold">
                  <Layers size={14} className="text-[var(--accent)]" /> Crear una plantilla desde cero
                  <ChevronDown size={14} className="ml-auto transition-transform group-open/crear:rotate-180" />
                </summary>
                <div className="border-t border-[var(--border)] p-3">
                  <PartsEditor layout={layout} onChange={patchLayout} />
                </div>
              </details>
            </Bloque>

            <Bloque
              id="notas"
              titulo="Notas de la portada"
              resumen={`${items.length} notas · ${estiladas} con estilo propio`}
              icono={<ListOrdered size={13} />}
              abierto={!!openBlocks.notas}
              onToggle={toggle("notas")}
            >
              <NotasLista items={items} selected={selected} onSelect={selectNota} onMove={moveItem} />
            </Bloque>

            <Bloque
              id="menu"
              titulo="Menú y secciones"
              resumen={`${sections.length} secciones en el sitio`}
              icono={<ListTree size={13} />}
              abierto={!!openBlocks.menu}
              onToggle={toggle("menu")}
            >
              <p className="mb-3 text-xs leading-relaxed text-[var(--fg-muted)]">
                Así cuelga cada sección del menú. Pulsa una para ver de cuál depende y editar su nombre, descripción y orden. Estos cambios se guardan al momento, no pasan por el borrador.
              </p>
              <SectionTree
                sections={sections}
                onSaved={() => {
                  setFrameNonce((n) => n + 1);
                  router.refresh();
                }}
              />
            </Bloque>

            <Bloque
              id="publicidad"
              titulo="Publicidad"
              resumen={anunciosActivos ? `${anunciosActivos} ${anunciosActivos === 1 ? "anuncio activo" : "anuncios activos"}` : "Sin anuncios activos"}
              icono={<Megaphone size={13} />}
              abierto={!!openBlocks.publicidad}
              onToggle={toggle("publicidad")}
            >
              <AdsPanel layout={layout} zones={adsZones} canManage={canManagePauta} drafts={adDrafts} onDraft={(key, draft) => setAdDrafts((d) => ({ ...d, [key]: draft }))} />
            </Bloque>

            <Bloque
              id="popup"
              titulo="Ventana emergente"
              resumen={popup.enabled ? `Activada · ${formatoPopup}` : "Apagada"}
              icono={<MessageSquare size={13} />}
              abierto={!!openBlocks.popup}
              onToggle={(open) => {
                toggle("popup")(open);
                setPopupPreview(open);
              }}
            >
              <PopupEditor
                value={popup}
                // Cada cambio se ve al instante: la ventana aparece en el lienzo.
                onChange={(p) => {
                  setPopup(p);
                  setPopupPreview(true);
                }}
                previewing={popupPreview}
                onPreview={setPopupPreview}
              />
            </Bloque>
          </>
        )}
      </aside>

      {ampliado && (
        <button
          type="button"
          onClick={() => setPanelAbierto((v) => !v)}
          aria-expanded={panelAbierto}
          data-theme="panel-ui"
          className="fixed bottom-5 right-5 z-40 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-fg)] shadow-xl"
        >
          <SlidersHorizontal size={15} /> {panelAbierto ? "Cerrar opciones" : "Opciones"}
        </button>
      )}

      <PortadaToast toast={toast} onClose={closeToast} />
    </div>
  );
}

/** Bloque plegable de la barra lateral. Arranca cerrado salvo que se pida; su estado lo lleva quien lo usa. */
function Bloque({
  id,
  titulo,
  resumen,
  icono,
  children,
  abierto = false,
  onToggle,
  destacar,
}: {
  id: string;
  titulo: string;
  /** Una línea con el estado actual, visible aunque el bloque esté cerrado. */
  resumen?: string;
  icono: React.ReactNode;
  children: React.ReactNode;
  abierto?: boolean;
  onToggle?: (open: boolean) => void;
  /** Cambia cuando el bloque debe destellar (p. ej. al elegir algo en la página). */
  destacar?: number;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !destacar) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el.classList.remove("cg-flash");
    void el.offsetWidth;
    el.classList.add("cg-flash");
    const t = setTimeout(() => el.classList.remove("cg-flash"), 1000);
    return () => clearTimeout(t);
  }, [destacar]);
  return (
    <details
      ref={ref}
      id={`bloque-${id}`}
      open={abierto}
      onToggle={(e) => onToggle?.((e.currentTarget as HTMLDetailsElement).open)}
      className="group rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] shadow-[var(--shadow)]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3">
        <span className="shrink-0 text-[var(--accent)]">{icono}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.78rem] font-bold uppercase tracking-[0.12em] text-[var(--fg)]">{titulo}</span>
          {resumen && <span className="mt-0.5 block truncate text-xs text-[var(--fg-muted)]">{resumen}</span>}
        </span>
        <ChevronDown size={14} aria-hidden className="shrink-0 text-[var(--fg-muted)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-[var(--border)] p-4">{children}</div>
    </details>
  );
}
