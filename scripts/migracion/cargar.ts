/**
 * Paso 2 de la migración: carga en la base del portal nuevo las notas que `descargar.ts` guardó en la caché local.
 *
 * Qué hace, en orden:
 *  1. Crea las categorías que faltan (Galería, Video, Audio) y la dirección antigua `/blog` de Blogs.
 *  2. Crea los autores que no existen (y les copia la foto).
 *  3. Decide la dirección final de cada nota: la misma del sitio anterior cuando es válida; si la nota estaba repetida en dos
 *     secciones, una sola nota; si eran notas distintas con el mismo título, se distinguen con la sección.
 *  4. Copia a nuestro almacenamiento las imágenes y los audios, reescribe el cuerpo y guarda la nota (INSERT … ON CONFLICT: se puede
 *     repetir sin duplicar; no toca notas creadas por la redacción en el panel).
 *  5. Guarda una redirección 301 por cada dirección antigua (`/seccion/titulo` → `/articulo/titulo`), incluidas las de títulos que
 *     hubo que normalizar, y escribe un informe en `.migracion-cache/informe-carga.json`.
 *
 * Por defecto trabaja contra la base LOCAL de desarrollo (PGlite) y no sube nada: es el ensayo. Para la base real hay que pedirlo
 * con `--produccion` (usa DATABASE_URL o la de `.env.migracion`). `--simulacro` hace todo menos escribir y menos subir imágenes.
 *
 * Uso: npx tsx --conditions=react-server scripts/migracion/cargar.ts [--produccion] [--simulacro] [--sin-imagenes] [--limite=N] [--lote=100]
 */
import { createReadStream, existsSync, readdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { and, eq, isNull, sql } from "drizzle-orm";
import { CACHE, DIR_HISTORIAS, prepararCache, urlBaseDeDatos } from "./comun";
import type { NotaDescargada } from "./extraer";
import { CATEGORIAS_NUEVAS, RUTAS_ANTIGUAS_EXTRA, aCategoria, elegirCategoria, type Arbol } from "./categorias";
import { CopiadorDeImagenes, copiadorNulo } from "./imagenes";
import { autorDe, camposBasicos, construirCuerpo, esImagenCopiable, normalizarSlug, recursosDe, urlBaseImagen, type Contexto } from "./transformar";

const bandera = (n: string) => process.argv.includes(`--${n}`);
const valor = (n: string, def: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? def;
const PRODUCCION = bandera("produccion");
const SIMULACRO = bandera("simulacro");
const SIN_IMAGENES = bandera("sin-imagenes");
const LIMITE = Number(valor("limite", "0"));
const LOTE = Number(valor("lote", "100"));

// Registros de la caché (el más reciente de cada dirección), de uno en uno para no cargar cientos de MB en memoria.
async function* leerRegistros(): AsyncGenerator<NotaDescargada> {
  const vistos = new Set<string>();
  const archivos = existsSync(DIR_HISTORIAS) ? readdirSync(DIR_HISTORIAS).filter((f) => f.endsWith(".jsonl")).sort().reverse() : [];
  for (const f of archivos) {
    const rl = createInterface({ input: createReadStream(join(DIR_HISTORIAS, f), "utf8"), crlfDelay: Infinity });
    for await (const linea of rl) {
      if (!linea) continue;
      let r: NotaDescargada;
      try {
        r = JSON.parse(linea) as NotaDescargada;
      } catch {
        continue;
      }
      if (vistos.has(r.path)) continue;
      vistos.add(r.path);
      if (r.story) yield r;
    }
  }
}

// Registro mínimo para reutilizar `autorDe` con un autor suelto.
const registroVacio: NotaDescargada = { path: "", status: 200, ld: null, story: { id: 0, uuid: "", name: "", slug: "", full_slug: "", created_at: null, first_published_at: null, published_at: null, updated_at: null, tag_list: [], content: {} } };

/** Lo mínimo de cada nota para decidir direcciones y categorías sin tener todas en memoria. */
type Ligera = { path: string; carpeta: string; slugOrig: string; titulo: string; pub: number | null; secciones: string[]; autorUuid: string; idCorto: string; riqueza: number };

/** Repite una operación de base de datos si falla por algo pasajero (conexión cortada, tiempo agotado del pooler). */
async function conReintentos<T>(f: () => Promise<T>, intentos = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await f();
    } catch (e) {
      if (i >= intentos) throw e;
      console.warn(`Falló una operación de la base (intento ${i}/${intentos}): ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`);
      await new Promise((ok) => setTimeout(ok, 2000 * i));
    }
  }
}

/** Cuánto contenido trae una nota (texto, fotos de galería, audio): sirve para quedarse con la versión más completa si estaba repetida. */
function riquezaDe(c: Record<string, unknown>): number {
  const cuerpo = (c.body as { html?: string } | undefined)?.html?.length ?? 0;
  const fotos = (Array.isArray(c.gallery) ? c.gallery : []).reduce((n: number, g) => n + ((g as { items?: unknown[] }).items?.length ?? 0), 0);
  const audio = Array.isArray(c.audio) ? c.audio.length : (c.audio as { filename?: string } | undefined)?.filename ? 1 : 0;
  return cuerpo + fotos * 400 + audio * 2000;
}

const normTitulo = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const DOS_DIAS = 2 * 24 * 3600_000;

async function main() {
  prepararCache();
  if (PRODUCCION) process.env.DATABASE_URL = urlBaseDeDatos();
  const t0 = Date.now();
  const { db } = await import("@/db");
  const { articles, authors, categories, redirects } = await import("@/db/schema");
  console.log(`Base: ${PRODUCCION ? "PRODUCCIÓN (Supabase)" : "local de desarrollo (PGlite)"} · ${SIMULACRO ? "SIMULACRO (no escribe)" : "escribe"} · imágenes: ${SIN_IMAGENES || SIMULACRO ? "no se copian" : "se copian a Storage"}`);

  // --- Pasada 1: índice ligero de todas las notas --------------------------------------------------------------------------
  const ligeras: Ligera[] = [];
  const autoresPorUuid = new Map<string, { name: string; slug: string; image: string | null }>();
  const componentes: Record<string, number> = {};
  for await (const r of leerRegistros()) {
    const st = r.story!;
    const c = st.content as Record<string, unknown>;
    componentes[String(c.component)] = (componentes[String(c.component)] ?? 0) + 1;
    const a = c.author as { uuid?: string; name?: string; slug?: string; image?: string | null } | string | undefined;
    if (a && typeof a === "object" && a.uuid && a.name) autoresPorUuid.set(a.uuid, { name: a.name, slug: a.slug ?? "", image: a.image ?? null });
    ligeras.push({
      path: r.path,
      carpeta: r.path.split("/")[1] ?? "",
      slugOrig: st.slug,
      titulo: camposBasicos(r).titulo,
      pub: st.first_published_at ? Date.parse(st.first_published_at) : null,
      secciones: Array.isArray(c.sections) ? (c.sections as string[]) : [],
      autorUuid: typeof a === "string" ? a : a?.uuid ?? "",
      idCorto: String(st.id).slice(-6),
      riqueza: riquezaDe(c),
    });
    if (LIMITE && ligeras.length >= LIMITE) break;
  }
  console.log(`Notas en la caché: ${ligeras.length} · componentes: ${JSON.stringify(componentes)}`);

  // --- Categorías ----------------------------------------------------------------------------------------------------------
  let cats = await db.select({ id: categories.id, slug: categories.slug, parentId: categories.parentId, legacyPaths: categories.legacyPaths }).from(categories);
  const idPorSlug = new Map(cats.map((c) => [c.slug, c.id]));
  for (const [i, n] of CATEGORIAS_NUEVAS.entries()) {
    if (idPorSlug.has(n.slug)) continue;
    const parentId = idPorSlug.get(n.parent);
    if (!parentId) throw new Error(`La categoría padre «${n.parent}» no existe: no se puede crear «${n.slug}».`);
    console.log(`Categoría nueva: ${n.slug} (dentro de ${n.parent})`);
    if (!SIMULACRO) {
      const [c] = await db.insert(categories).values({ slug: n.slug, name: n.name, description: n.description, parentId, legacyPaths: n.legacyPaths, sortOrder: 90 + i }).returning({ id: categories.id });
      idPorSlug.set(n.slug, c.id);
    } else idPorSlug.set(n.slug, `simulada-${n.slug}`);
  }
  for (const [slug, extra] of Object.entries(RUTAS_ANTIGUAS_EXTRA)) {
    const c = cats.find((x) => x.slug === slug);
    if (!c || extra.every((e) => c.legacyPaths.includes(e)) || SIMULACRO) continue;
    await db.update(categories).set({ legacyPaths: [...new Set([...c.legacyPaths, ...extra])] }).where(eq(categories.id, c.id));
    console.log(`Categoría ${slug}: se añade la dirección antigua ${extra.join(", ")}`);
  }
  cats = await db.select({ id: categories.id, slug: categories.slug, parentId: categories.parentId, legacyPaths: categories.legacyPaths }).from(categories);
  const slugPorId = new Map(cats.map((c) => [c.id, c.slug]));
  const arbol: Arbol = new Map(cats.map((c) => [c.slug, c.parentId ? slugPorId.get(c.parentId) ?? null : null]));
  for (const n of CATEGORIAS_NUEVAS) if (!arbol.has(n.slug)) arbol.set(n.slug, n.parent); // simulacro

  // Nombres de carpeta o de sección del sitio anterior que no corresponden a ninguna categoría (para decidir si falta crear alguna).
  const sinCategoriaPropia: Record<string, number> = {};
  for (const l of ligeras) for (const k of [l.carpeta, ...l.secciones]) if (k && k !== "home" && !aCategoria(k, arbol)) sinCategoriaPropia[k] = (sinCategoriaPropia[k] ?? 0) + 1;
  if (Object.keys(sinCategoriaPropia).length) console.log(`Carpetas/secciones sin categoría equivalente: ${JSON.stringify(sinCategoriaPropia)}`);

  // --- Direcciones finales -------------------------------------------------------------------------------------------------
  const existentes = await db.select({ slug: articles.slug, titulo: articles.title, creadaPorRedaccion: sql<boolean>`${articles.createdBy} is not null` }).from(articles);
  const delaRedaccion = new Map(existentes.filter((e) => e.creadaPorRedaccion).map((e) => [e.slug, e.titulo]));
  // Notas que una carga anterior ya trajo (sin autor del panel): si su dirección cambia al normalizarla, se renombran en vez de duplicarse.
  const migradasAntes = new Set(existentes.filter((e) => !e.creadaPorRedaccion).map((e) => e.slug));
  const tomados = new Set(delaRedaccion.keys());
  const porSlug = new Map<string, Ligera[]>();
  for (const l of ligeras) {
    const base = normalizarSlug(l.slugOrig, l.idCorto);
    (porSlug.get(base) ?? porSlug.set(base, []).get(base)!).push(l);
  }
  const slugFinalPorPath = new Map<string, string | null>(); // null = la nota ya existe en el panel: solo se redirige
  const destinoPorPath = new Map<string, string>(); // path antiguo -> /articulo/slug
  const miembrosPorSlug = new Map<string, Ligera[]>(); // slug final -> todas las direcciones antiguas que son esa misma nota
  const canonicaPorSlug = new Map<string, string>(); // slug final -> la copia que se guarda: la más completa si la nota estaba repetida en dos secciones
  const informe = { duplicadasMismaNota: [] as string[], distintasMismoTitulo: [] as string[], slugsNormalizados: [] as string[], conflictoConRedaccion: [] as string[] };
  for (const [base, miembros] of [...porSlug].sort((a, b) => a[0].localeCompare(b[0]))) {
    miembros.sort((a, b) => (a.pub ?? 0) - (b.pub ?? 0) || a.path.localeCompare(b.path));
    // Agrupa los que son la misma nota (mismo título y fecha casi igual) bajo una sola dirección.
    const grupos: Ligera[][] = [];
    for (const m of miembros) {
      const g = grupos.find((x) => normTitulo(x[0].titulo) === normTitulo(m.titulo) && Math.abs((x[0].pub ?? 0) - (m.pub ?? 0)) <= DOS_DIAS);
      if (g) g.push(m);
      else grupos.push([m]);
    }
    for (const [i, g] of grupos.entries()) {
      let slug = base;
      const redaccion = delaRedaccion.get(base);
      if (redaccion !== undefined && normTitulo(redaccion) === normTitulo(g[0].titulo)) {
        // La redacción ya publicó esta misma nota desde el panel: se respeta y las direcciones antiguas la apuntan.
        informe.conflictoConRedaccion.push(`${g[0].path} → ya existe en el panel`);
        for (const m of g) { slugFinalPorPath.set(m.path, null); destinoPorPath.set(m.path, `/articulo/${base}`); }
        continue;
      }
      if (i > 0 || tomados.has(slug)) {
        const conCarpeta = `${base}-${normalizarSlug(g[0].carpeta)}`.slice(0, 220);
        slug = !tomados.has(conCarpeta) ? conCarpeta : `${conCarpeta}-${g[0].idCorto}`;
        informe.distintasMismoTitulo.push(`${g.map((m) => m.path).join(" | ")} → ${slug}`);
      }
      tomados.add(slug);
      if (g.length > 1) informe.duplicadasMismaNota.push(g.map((m) => m.path).join(" | "));
      if (slug !== g[0].slugOrig) informe.slugsNormalizados.push(`${g[0].slugOrig} → ${slug}`);
      canonicaPorSlug.set(slug, [...g].sort((a, b) => b.riqueza - a.riqueza || a.path.localeCompare(b.path))[0].path);
      miembrosPorSlug.set(slug, g);
      for (const m of g) { slugFinalPorPath.set(m.path, slug); destinoPorPath.set(m.path, `/articulo/${slug}`); }
    }
  }
  const claveEnlace = (p: string) => p.toLowerCase().replace(/-+$/, "");
  const destinoPorClave = new Map([...destinoPorPath].map(([p, d]) => [claveEnlace(p), d]));

  // --- Autores -------------------------------------------------------------------------------------------------------------
  const copiador = SIN_IMAGENES || SIMULACRO ? copiadorNulo : new CopiadorDeImagenes(Number(valor("concurrencia", "8")));
  const normNombre = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const autoresBD = await db.select({ id: authors.id, slug: authors.slug, name: authors.name, avatarUrl: authors.avatarUrl }).from(authors);
  const autorIdPorNombre = new Map(autoresBD.map((a) => [normNombre(a.name), a.id]));
  const autorIdPorSlug = new Map(autoresBD.map((a) => [a.slug, a.id]));
  const slugsAutor = new Set(autoresBD.map((a) => a.slug));
  const autoresNuevos: string[] = [];
  const memoAutor = new Map<string, { id: string | null; slug: string }>();
  /** Autor del portal nuevo (existente o creado ahora) para un autor del sitio anterior; se reconoce por nombre o por dirección. */
  async function idDeAutor(a: { nombre: string; slug: string; imagen: string | null }): Promise<{ id: string | null; slug: string }> {
    const clave = normNombre(a.nombre);
    const memo = memoAutor.get(clave);
    if (memo) return memo;
    const id = autorIdPorNombre.get(clave) ?? autorIdPorSlug.get(a.slug);
    let res: { id: string | null; slug: string };
    if (id) {
      const existente = autoresBD.find((x) => x.id === id)!;
      if (!existente.avatarUrl && a.imagen && !SIMULACRO && esImagenCopiable(a.imagen)) {
        const url = await copiador.copiar(urlBaseImagen(a.imagen));
        if (url) await db.update(authors).set({ avatarUrl: url }).where(and(eq(authors.id, id), isNull(authors.avatarUrl)));
      }
      res = { id, slug: existente.slug };
    } else {
      let slug = a.slug || normalizarSlug(a.nombre);
      for (let n = 2; slugsAutor.has(slug); n++) slug = `${a.slug}-${n}`;
      slugsAutor.add(slug);
      autoresNuevos.push(a.nombre);
      if (SIMULACRO) res = { id: null, slug };
      else {
        const avatar = a.imagen && esImagenCopiable(a.imagen) ? await copiador.copiar(urlBaseImagen(a.imagen)) : null;
        const [{ id: nuevo }] = await db.insert(authors).values({ slug, name: a.nombre, avatarUrl: avatar }).returning({ id: authors.id });
        autorIdPorNombre.set(clave, nuevo);
        autorIdPorSlug.set(slug, nuevo);
        res = { id: nuevo, slug };
      }
    }
    memoAutor.set(clave, res);
    return res;
  }
  // Páginas de columnista del sitio anterior (`/SearchColumnista/<id>/<página>`) → página del autor nuevo.
  const redireccionesAutores: (typeof redirects.$inferInsert)[] = [];
  for (const [uuid, a] of autoresPorUuid) {
    const { slug } = await idDeAutor(autorDe({ ...registroVacio, story: { ...registroVacio.story!, content: { author: { uuid, name: a.name, slug: a.slug, image: a.image, labels: [] } } } }, autoresPorUuid));
    redireccionesAutores.push({ fromPath: `/SearchColumnista/${uuid}`, toPath: `/autor/${slug}`, statusCode: 301 });
  }
  if (!SIMULACRO && redireccionesAutores.length) {
    await db.insert(redirects).values(redireccionesAutores).onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: sql`excluded.to_path`, statusCode: sql`excluded.status_code` } });
  }
  console.log(`Autores: ${autoresPorUuid.size} en el sitio anterior · ${autoresNuevos.length} nuevos en el portal`);

  // --- Pasada 2: notas, por lotes ------------------------------------------------------------------------------------------
  const ctxBase = (mapa: Map<string, string>): Contexto => ({
    imagen: (u) => mapa.get(u) ?? null,
    enlace: (ruta) => destinoPorClave.get(claveEnlace(ruta)) ?? null,
  });
  const resumen = { notas: 0, nuevas: 0, actualizadas: 0, renombradas: 0, omitidasRedaccion: 0, sinCategoria: 0, sinPortada: 0, redireccionesGuardadas: 0 };
  const porCategoria: Record<string, number> = {};
  const publicadasPorAnio: Record<string, number> = {};
  let lote: NotaDescargada[] = [];
  let procesadas = 0;

  async function procesarLote(registros: NotaDescargada[]) {
    // Imágenes del lote (en paralelo, con tope en el copiador).
    const recursos = [...new Set(registros.flatMap((r) => recursosDe(r)))];
    const mapa = new Map<string, string>();
    await Promise.all(recursos.map(async (u) => { const n = await copiador.copiar(u); if (n) mapa.set(u, n); }));
    const ctx = ctxBase(mapa);
    const filas: (typeof articles.$inferInsert)[] = [];
    const reds: (typeof redirects.$inferInsert)[] = [];
    for (const r of registros) {
      const slug = slugFinalPorPath.get(r.path);
      if (slug === undefined) continue;
      const destino = destinoPorPath.get(r.path)!;
      for (const desde of new Set([r.path, encodeURI(r.path)])) reds.push({ fromPath: desde, toPath: destino, statusCode: 301 });
      if (slug === null) { resumen.omitidasRedaccion++; continue; }
      // Una nota repetida en dos secciones se guarda una sola vez (la más antigua); la otra dirección solo lleva su redirección.
      if (canonicaPorSlug.get(slug) !== r.path) continue;
      const original = r.story!.slug;
      if (slug !== original && migradasAntes.has(original) && !migradasAntes.has(slug) && !SIMULACRO) {
        await db.update(articles).set({ slug }).where(and(eq(articles.slug, original), isNull(articles.createdBy)));
        migradasAntes.delete(original);
        migradasAntes.add(slug);
        resumen.renombradas++;
      }
      const b = camposBasicos(r);
      const c = r.story!.content as Record<string, unknown>;
      const { principal, todas: propias } = elegirCategoria(r.path.split("/")[1] ?? "", Array.isArray(c.sections) ? (c.sections as string[]) : [], arbol);
      // Si la nota estaba en dos secciones del sitio anterior (dos direcciones), aparece en todas.
      const todas = [...new Set([...propias, ...(miembrosPorSlug.get(slug) ?? []).flatMap((m) => elegirCategoria(m.carpeta, m.secciones, arbol).todas)])];
      if (!principal) resumen.sinCategoria++;
      const portadaFuente = (c.teaser_image as { filename?: string } | undefined)?.filename;
      const portada = portadaFuente && esImagenCopiable(portadaFuente) ? (SIN_IMAGENES || SIMULACRO ? urlBaseImagen(portadaFuente) : mapa.get(urlBaseImagen(portadaFuente)) ?? null) : null;
      if (!portada) resumen.sinPortada++;
      const autor = await idDeAutor(autorDe(r, autoresPorUuid));
      const cuerpo = construirCuerpo(r, b.resumen, ctx);
      const publicadaEn = b.publicadaEn ?? b.creadaEn ?? new Date();
      porCategoria[principal ?? "(ninguna)"] = (porCategoria[principal ?? "(ninguna)"] ?? 0) + 1;
      publicadasPorAnio[String(publicadaEn.getUTCFullYear())] = (publicadasPorAnio[String(publicadaEn.getUTCFullYear())] ?? 0) + 1;
      filas.push({
        slug,
        title: b.titulo,
        excerpt: b.resumen,
        body: cuerpo,
        coverImageUrl: portada,
        coverImageAlt: portada ? b.portadaAlt : null,
        coverImageCaption: portada ? b.pie : null,
        categoryId: principal ? idPorSlug.get(principal) ?? null : null,
        authorId: autor.id,
        status: "publicado",
        metaTitle: b.metaTitulo,
        metaDescription: b.metaDescripcion,
        tags: b.etiquetas,
        secciones: todas,
        publishedAt: publicadaEn,
        createdAt: b.creadaEn ?? publicadaEn,
        updatedAt: b.actualizadaEn ?? publicadaEn,
      });
    }
    resumen.notas += filas.length;
    if (SIMULACRO) { resumen.redireccionesGuardadas += reds.length; return; }
    // Notas: se insertan o se actualizan (nunca las creadas desde el panel). Lo que edita la redacción (portada, vistas, embeddings) no se toca.
    if (filas.length) {
      const guardadas = await conReintentos(() => db
        .insert(articles)
        .values(filas)
        .onConflictDoUpdate({
          target: articles.slug,
          set: {
            title: sql`excluded.title`, excerpt: sql`excluded.excerpt`, body: sql`excluded.body`,
            coverImageUrl: sql`excluded.cover_image_url`, coverImageAlt: sql`excluded.cover_image_alt`, coverImageCaption: sql`excluded.cover_image_caption`,
            categoryId: sql`excluded.category_id`, authorId: sql`excluded.author_id`, status: sql`excluded.status`,
            metaTitle: sql`excluded.meta_title`, metaDescription: sql`excluded.meta_description`, tags: sql`excluded.tags`, secciones: sql`excluded.secciones`,
            publishedAt: sql`excluded.published_at`, updatedAt: sql`excluded.updated_at`, createdAt: sql`excluded.created_at`,
          },
          setWhere: isNull(articles.createdBy),
        })
        .returning({ slug: articles.slug, nueva: sql<boolean>`(xmax = 0)` }));
      resumen.nuevas += guardadas.filter((g) => g.nueva).length;
      resumen.actualizadas += guardadas.filter((g) => !g.nueva).length;
      resumen.omitidasRedaccion += filas.length - guardadas.length;
    }
    for (let i = 0; i < reds.length; i += 500) {
      await conReintentos(() => db.insert(redirects).values(reds.slice(i, i + 500)).onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: sql`excluded.to_path`, statusCode: sql`excluded.status_code` } }));
    }
    resumen.redireccionesGuardadas += reds.length;
  }

  let hechas = 0;
  for await (const r of leerRegistros()) {
    lote.push(r);
    hechas++;
    if (lote.length >= LOTE) {
      await procesarLote(lote);
      procesadas += lote.length;
      lote = [];
      if (procesadas % (LOTE * 5) === 0) console.log(`${procesadas}/${ligeras.length} · imágenes: ${JSON.stringify(copiador.estadisticas)} · ${Math.round((Date.now() - t0) / 60000)} min`);
    }
    if (LIMITE && hechas >= LIMITE) break;
  }
  if (lote.length) await procesarLote(lote);

  // --- Informe -------------------------------------------------------------------------------------------------------------
  const informeFinal = { fecha: new Date().toISOString(), produccion: PRODUCCION, simulacro: SIMULACRO, resumen, sinCategoriaPropia, autoresNuevos, imagenes: copiador.estadisticas, porCategoria, publicadasPorAnio, ...informe };
  writeFileSync(join(CACHE, "informe-carga.json"), JSON.stringify(informeFinal, null, 1));
  console.log(JSON.stringify({ resumen, autoresNuevos: autoresNuevos.length, imagenes: copiador.estadisticas, duplicadasMismaNota: informe.duplicadasMismaNota.length, distintasMismoTitulo: informe.distintasMismoTitulo.length, slugsNormalizados: informe.slugsNormalizados.length, conflictoConRedaccion: informe.conflictoConRedaccion.length }, null, 1));
  console.log(`Informe completo: .migracion-cache/informe-carga.json · ${Math.round((Date.now() - t0) / 1000)} s`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
