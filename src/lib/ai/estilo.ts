import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings, users } from "@/db/schema";
import { ESTILO_VACIO, bloqueEstilo, estiloClave, type EstiloEscritura } from "@/lib/ai/estilo-tipos";

/** Lo guardado del estilo de una persona (vacío si no hay nada o la lectura falla: nunca rompe la redacción). */
export async function getEstilo(userId: string): Promise<EstiloEscritura> {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, estiloClave(userId))).limit(1);
    const v = row?.value as Partial<EstiloEscritura> | undefined;
    if (!v || typeof v !== "object") return { ...ESTILO_VACIO };
    return { fuentes: Array.isArray(v.fuentes) ? v.fuentes : [], diagnostico: v.diagnostico ?? null, activo: v.activo !== false };
  } catch {
    return { ...ESTILO_VACIO };
  }
}

/** Guarda el estilo de una persona. */
export async function guardarEstilo(userId: string, e: EstiloEscritura): Promise<void> {
  await db
    .insert(siteSettings)
    .values({ key: estiloClave(userId), value: e })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: e, updatedAt: sql`now()` } });
}

/** Borra el estilo de una persona. */
export async function borrarEstilo(userId: string): Promise<void> {
  await db.delete(siteSettings).where(eq(siteSettings.key, estiloClave(userId)));
}

/** El `system` de redacción con el estilo de la persona añadido, si lo tiene activo. */
export async function sistemaConEstilo(base: string, userId: string): Promise<string> {
  const bloque = bloqueEstilo(await getEstilo(userId));
  return bloque ? `${base}\n\n${bloque}` : base;
}

/* -------------------------------------------------------------------------------------------------------------------------------
 * Escritores: además de la gente de la redacción (cada usuario tiene su estilo), el administrador puede registrar escritores EXTERNOS
 * (columnistas, firmas invitadas, un referente) y enseñarle a la IA cómo escriben. Cada escritor es un perfil `estilo_escritura:<id>`.
 * ------------------------------------------------------------------------------------------------------------------------------- */

const EXTERNOS_KEY = "estilo_escritores_externos";
export type EscritorExterno = { id: string; nombre: string; creadoEn: string };

/** Lo que se muestra de cada escritor en las listas (sin el texto de las muestras). */
export type Escritor = {
  id: string;
  nombre: string;
  /** `redaccion`: una persona con cuenta en el panel; `externo`: un escritor registrado por el administrador. */
  tipo: "redaccion" | "externo";
  rol?: string;
  muestras: number;
  palabras: number;
  conDiagnostico: boolean;
  activo: boolean;
  generadoEn: string | null;
  tono: string[];
};

/** Escritores externos registrados. */
export async function leerExternos(): Promise<EscritorExterno[]> {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, EXTERNOS_KEY)).limit(1);
    const v = row?.value;
    return Array.isArray(v) ? (v as EscritorExterno[]).filter((x) => x && typeof x.id === "string" && typeof x.nombre === "string") : [];
  } catch {
    return [];
  }
}

async function guardarExternos(lista: EscritorExterno[]): Promise<void> {
  await db.insert(siteSettings).values({ key: EXTERNOS_KEY, value: lista }).onConflictDoUpdate({ target: siteSettings.key, set: { value: lista, updatedAt: sql`now()` } });
}

/** Registra un escritor externo y devuelve su ficha. */
export async function crearExterno(nombre: string): Promise<EscritorExterno> {
  const limpio = nombre.replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (limpio.length < 3) throw new Error("Escribe el nombre del escritor (mínimo 3 letras).");
  const lista = await leerExternos();
  if (lista.some((x) => x.nombre.toLowerCase() === limpio.toLowerCase())) throw new Error("Ya hay un escritor con ese nombre.");
  const nuevo = { id: crypto.randomUUID(), nombre: limpio, creadoEn: new Date().toISOString() };
  await guardarExternos([...lista, nuevo]);
  return nuevo;
}

/** Quita un escritor externo y todo su aprendizaje. */
export async function quitarExterno(id: string): Promise<void> {
  const lista = await leerExternos();
  await guardarExternos(lista.filter((x) => x.id !== id));
  await borrarEstilo(id);
}

/** ¿Es un escritor válido (una persona del panel o un externo registrado)? */
export async function esEscritorValido(id: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  if ((await leerExternos()).some((x) => x.id === id)) return true;
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  return !!u;
}

/** Nombre de un escritor (vacío si no existe). */
export async function nombreDeEscritor(id: string): Promise<string> {
  const ext = (await leerExternos()).find((x) => x.id === id);
  if (ext) return ext.nombre;
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, id)).limit(1);
  return u?.name ?? "";
}

/** Todos los escritores con un resumen de su aprendizaje: la gente del panel y los externos. */
export async function listarEscritores(): Promise<Escritor[]> {
  const [personas, externos] = await Promise.all([
    db.select({ id: users.id, nombre: users.name, rol: users.role }).from(users).orderBy(users.name),
    leerExternos(),
  ]);
  const base = [
    ...personas.map((p) => ({ id: p.id, nombre: p.nombre ?? "Sin nombre", tipo: "redaccion" as const, rol: p.rol as string })),
    ...externos.map((e) => ({ id: e.id, nombre: e.nombre, tipo: "externo" as const, rol: undefined as string | undefined })),
  ];
  return Promise.all(
    base.map(async (b) => {
      const e = await getEstilo(b.id);
      return {
        ...b,
        muestras: e.fuentes.length,
        palabras: e.fuentes.reduce((t, f) => t + f.palabras, 0),
        conDiagnostico: !!e.diagnostico,
        activo: e.activo,
        generadoEn: e.diagnostico?.generadoEn ?? null,
        tono: e.diagnostico?.tono.slice(0, 3) ?? [],
      };
    }),
  );
}

/** Escritores que `user` puede elegir para el consejo: el administrador, a todos; los demás, a sí mismos y a los escritores externos. */
export async function escritoresParaElegir(user: { id: string; role: string }): Promise<Escritor[]> {
  const todos = await listarEscritores();
  return user.role === "administrador" ? todos : todos.filter((e) => e.id === user.id || e.tipo === "externo");
}
