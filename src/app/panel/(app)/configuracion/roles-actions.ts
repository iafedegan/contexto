"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings, users, type UserRole } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PERMISO_IDS, ROLES, type PermisoId } from "@/lib/permisos";
import { PERMISOS_KEY, type MapaAjustes } from "@/lib/permisos-server";
import { getCambiosRoles, getRolesAsignados, getRolesPropios } from "@/lib/roles-server";
import { ROLES_ASIGNADOS_KEY, ROLES_BASE, ROLES_INCORPORADOS_KEY, ROLES_PROPIOS_KEY, ajustesDeRol, comoRolPropio, sanitizeCambiosRoles, sanitizeRolesPropios, type RolPropio } from "@/lib/roles";

type Resultado = { ok: boolean; message: string };

// Guarda un valor JSON en `site_settings`.
async function guardar(key: string, value: unknown) {
  await db.insert(siteSettings).values({ key, value }).onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: sql`now()` } });
}

// Lee el mapa de ajustes por persona, lo modifica y lo guarda.
async function conAjustes(mut: (m: MapaAjustes) => void) {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, PERMISOS_KEY)).limit(1);
  const v = row?.value;
  const mapa: MapaAjustes = v && typeof v === "object" && !Array.isArray(v) ? { ...(v as MapaAjustes) } : {};
  mut(mapa);
  await guardar(PERMISOS_KEY, mapa);
}

// Aplica un rol propio a unas personas: rol base + ajustes que lo reproducen.
async function aplicarRol(rol: RolPropio, userIds: string[]) {
  if (!userIds.length) return;
  for (const id of userIds) await db.update(users).set({ role: rol.base, updatedAt: new Date() }).where(eq(users.id, id));
  await conAjustes((m) => {
    for (const id of userIds) {
      const a = ajustesDeRol(rol, m[id]);
      if (a) m[id] = a;
      else delete m[id];
    }
  });
}

/** Crea un rol propio a partir de un rol base. Solo administradores. */
export async function crearRol(nombre: string, base: string): Promise<Resultado> {
  await requireRole("administrador");
  const limpio = nombre.trim().slice(0, 40);
  if (!limpio) return { ok: false, message: "Ponle un nombre al rol." };
  if (!ROLES_BASE.includes(base as UserRole)) return { ok: false, message: "Rol base inválido." };
  const roles = await getRolesPropios();
  const incorporados = ROLES.map((r) => (r === "disenador" ? "diseñador" : r));
  if ([...roles.map((r) => r.nombre.toLowerCase()), ...incorporados].includes(limpio.toLowerCase())) return { ok: false, message: "Ya existe un rol con ese nombre." };
  const id = `${limpio.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "rol"}-${randomBytes(2).toString("hex")}`;
  await guardar(ROLES_PROPIOS_KEY, [...roles, { id, nombre: limpio, base: base as UserRole, permisos: {} }]);
  revalidatePath("/panel/configuracion");
  return { ok: true, message: "Rol creado. Ajusta sus permisos y asígnalo desde Cuentas." };
}

/** Cambia el nombre y los permisos de un rol propio y los reaplica a quienes lo tienen. */
export async function guardarRol(id: string, nombre: string, permisos: Record<string, boolean>): Promise<Resultado> {
  await requireRole("administrador");
  const roles = await getRolesPropios();
  const actual = roles.find((r) => r.id === id);
  if (!actual) return { ok: false, message: "Ese rol ya no existe." };
  const limpio = nombre.trim().slice(0, 40);
  if (!limpio) return { ok: false, message: "El rol necesita un nombre." };
  const perm: RolPropio["permisos"] = {};
  for (const p of PERMISO_IDS) if (typeof permisos[p] === "boolean") perm[p as PermisoId] = permisos[p];
  const nuevo: RolPropio = { ...actual, nombre: limpio, permisos: perm };
  await guardar(ROLES_PROPIOS_KEY, sanitizeRolesPropios(roles.map((r) => (r.id === id ? nuevo : r))));
  const asignados = await getRolesAsignados();
  await aplicarRol(nuevo, Object.keys(asignados).filter((u) => asignados[u] === id));
  revalidatePath("/panel", "layout");
  return { ok: true, message: "Rol guardado." };
}

/** Elimina un rol propio: quienes lo tenían conservan su rol base, sin los permisos añadidos. */
export async function eliminarRol(id: string): Promise<Resultado> {
  await requireRole("administrador");
  const roles = await getRolesPropios();
  const rol = roles.find((r) => r.id === id);
  if (!rol) return { ok: false, message: "Ese rol ya no existe." };
  const asignados = await getRolesAsignados();
  const afectados = Object.keys(asignados).filter((u) => asignados[u] === id);
  await guardar(ROLES_PROPIOS_KEY, roles.filter((r) => r.id !== id));
  await guardar(ROLES_ASIGNADOS_KEY, Object.fromEntries(Object.entries(asignados).filter(([, r]) => r !== id)));
  await aplicarRol({ ...rol, permisos: {} }, afectados);
  revalidatePath("/panel", "layout");
  return { ok: true, message: "Rol eliminado." };
}

/**
 * Da a una persona un rol: uno de los cuatro de siempre o uno propio (`valor` = `rol:<id>`). Solo administradores y nunca sobre uno
 * mismo. Al pasar a un rol incorporado se limpian los permisos individuales (el segundo factor se conserva).
 */
export async function asignarRol(userId: string, valor: string): Promise<Resultado> {
  const me = await requireRole("administrador");
  if (me.id === userId) return { ok: false, message: "No puedes cambiar tu propio rol." };
  const asignados = { ...(await getRolesAsignados()) };
  if (valor.startsWith("rol:")) {
    const rol = (await getRolesPropios()).find((r) => r.id === valor.slice(4));
    if (!rol) return { ok: false, message: "Ese rol ya no existe." };
    asignados[userId] = rol.id;
    await guardar(ROLES_ASIGNADOS_KEY, asignados);
    await aplicarRol(rol, [userId]);
  } else {
    if (!ROLES.includes(valor as UserRole)) return { ok: false, message: "Rol inválido." };
    delete asignados[userId];
    await guardar(ROLES_ASIGNADOS_KEY, asignados);
    await db.update(users).set({ role: valor as UserRole, updatedAt: new Date() }).where(eq(users.id, userId));
    // Los permisos del rol de siempre, con los cambios que un administrador le haya hecho.
    const rolBase = comoRolPropio(valor as UserRole, await getCambiosRoles());
    await conAjustes((m) => {
      const a = valor === "administrador" ? undefined : ajustesDeRol(rolBase, m[userId]);
      if (a) m[userId] = a;
      else delete m[userId];
    });
  }
  revalidatePath("/panel", "layout");
  return { ok: true, message: "Rol asignado." };
}

/**
 * Cambia lo que da un rol de siempre (redactor, diseñador o editor) y lo reaplica a quienes lo tienen sin un rol propio. El
 * administrador no se puede restringir. `permisos` vacío restablece el rol a su configuración de fábrica.
 */
export async function guardarRolIncorporado(rol: string, permisos: Record<string, boolean>): Promise<Resultado> {
  await requireRole("administrador");
  if (!ROLES_BASE.includes(rol as UserRole)) return { ok: false, message: "Ese rol no se puede editar." };
  const todos = sanitizeCambiosRoles({ ...(await getCambiosRoles()), [rol]: permisos });
  await guardar(ROLES_INCORPORADOS_KEY, todos);
  const asignados = await getRolesAsignados();
  const personas = await db.select({ id: users.id }).from(users).where(eq(users.role, rol as UserRole));
  await aplicarRol(comoRolPropio(rol as UserRole, todos), personas.map((u) => u.id).filter((id) => !asignados[id]));
  revalidatePath("/panel", "layout");
  return { ok: true, message: "Rol guardado." };
}
