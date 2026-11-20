import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, users } from "@/db/schema";
import { slugify } from "@/lib/utils";
import { invalidarCache, TAG_CONTENIDO } from "@/lib/data-cache";
import { debeTomarNombreDeCuenta } from "@/lib/firma-nombre";

/**
 * Cada persona con cuenta activa del panel debe poder elegirse como autor de una
 * nota. `authors` es una tabla aparte (puede haber firmas sin login), así que aquí
 * se crea, si falta, la ficha de autor vinculada a cada usuario activo.
 */
let ultimaRevision = 0;
/** Cada cuánto se vuelve a revisar, por instancia, que cada cuenta tenga su ficha de autor (el listado de artículos lo pide en cada carga). */
const REVISION_CADA_MS = 10 * 60_000;

export async function ensureUserAuthors(opciones: { forzar?: boolean } = {}): Promise<void> {
  // Sin esta pausa, cada carga del listado pagaba dos consultas más antes de poder hacer nada; las cuentas nuevas se crean pocas veces al día.
  if (!opciones.forzar && Date.now() - ultimaRevision < REVISION_CADA_MS) return;
  ultimaRevision = Date.now();
  const [activos, existentes] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)),
    db.select({ id: authors.id, userId: authors.userId, slug: authors.slug, name: authors.name }).from(authors),
  ]);
  // Firmas que quedaron con un nombre de usuario («pfonseca») porque la cuenta se creó así y después se le puso el nombre real: toman el
  // nombre de la cuenta. Solo si la firma parece un usuario (una sola palabra, sin espacios) y la cuenta ya tiene nombre y apellido; una firma
  // que un administrador escribió a mano con espacios no se toca. La dirección (slug) no cambia, para no romper enlaces.
  let renombradas = 0;
  for (const a of existentes) {
    const u = a.userId ? activos.find((x) => x.id === a.userId) : undefined;
    if (!u || !debeTomarNombreDeCuenta(a.name, u.name)) continue;
    await db.update(authors).set({ name: u.name.trim() }).where(eq(authors.id, a.id));
    renombradas++;
  }
  if (renombradas) invalidarCache(TAG_CONTENIDO);
  const vinculados = new Set(existentes.map((a) => a.userId).filter(Boolean));
  const slugs = new Set(existentes.map((a) => a.slug));
  for (const u of activos) {
    if (vinculados.has(u.id)) continue;
    const base = slugify(u.name) || "autor";
    let slug = base;
    for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`;
    slugs.add(slug);
    await db.insert(authors).values({ slug, name: u.name, userId: u.id }).onConflictDoNothing();
  }
}

/** Ficha de autor de una cuenta del panel (la crea si falta). La firma de una nota es siempre quien la escribe. */
export async function autorDeUsuario(userId: string): Promise<string | null> {
  try {
    await ensureUserAuthors({ forzar: true });
    const [a] = await db.select({ id: authors.id }).from(authors).where(eq(authors.userId, userId)).limit(1);
    return a?.id ?? null;
  } catch {
    return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sinTildes = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Con qué ficha de autor se firma una nota al guardarla. La firma es de quien escribe, salvo que quien guarda sea ADMINISTRADOR: él puede
 * firmar por otra persona (la ficha que pida, si existe). Cualquier otro rol conserva la firma que la nota ya tiene (o la suya si es nueva):
 * lo que llegue del formulario no vale, porque se puede falsear.
 */
export async function firmaDeNota(user: { id: string; role: string }, pedida: unknown, notaId?: string | null): Promise<string | null> {
  const propia = await autorDeUsuario(user.id);
  let actual: string | null = null;
  if (notaId) {
    const [r] = await db.select({ a: articles.authorId }).from(articles).where(eq(articles.id, notaId)).limit(1);
    actual = r?.a ?? null;
  }
  if (user.role !== "administrador") return notaId ? (actual ?? propia) : propia;
  const id = typeof pedida === "string" ? pedida.trim() : "";
  if (UUID.test(id)) {
    const [a] = await db.select({ id: authors.id }).from(authors).where(eq(authors.id, id)).limit(1);
    if (a) return a.id;
  }
  return actual ?? propia;
}

export type FirmaCreada = { ok: true; id: string; name: string; creada: boolean } | { ok: false; message: string };

/** Crea la ficha de autor de una persona que firma sin cuenta en el panel. Si ya hay una con ese nombre (sin tildes ni mayúsculas), devuelve esa. */
export async function crearFirma(nombreCrudo: string): Promise<FirmaCreada> {
  const name = nombreCrudo.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 80) return { ok: false, message: "Escribe el nombre de la persona (de 2 a 80 letras)." };
  const todos = await db.select({ id: authors.id, name: authors.name, slug: authors.slug }).from(authors);
  const igual = todos.find((a) => sinTildes(a.name) === sinTildes(name));
  if (igual) return { ok: true, id: igual.id, name: igual.name, creada: false };
  const slugs = new Set(todos.map((a) => a.slug));
  const base = slugify(name) || "autor";
  let slug = base;
  for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`;
  const [nueva] = await db.insert(authors).values({ slug, name }).returning({ id: authors.id });
  return { ok: true, id: nueva.id, name, creada: true };
}
