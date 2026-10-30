"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { siteSettings, users, type UserRole } from "@/db/schema";
import { CUOTAS_KEY, type Cuotas } from "@/lib/ai-cuota";
import { LIMITES_KEY } from "@/lib/budget";
import { DOS_PASOS, PERMISO_IDS, porDefecto, type PermisoId } from "@/lib/permisos";
import { PERMISOS_KEY, type MapaAjustes } from "@/lib/permisos-server";
import { auth, requireRole } from "@/lib/auth";
import { SITE_IDENTITY_KEY, type SiteIdentity } from "@/lib/site-identity";
import { SECRETS_KEY, claveEfectiva } from "@/lib/ai-provider";
import { ANALYTICS_KEY, GA4_ID_RE, GTM_ID_RE, type AnalyticsSettings } from "@/lib/analytics";
import { readAnalytics } from "@/lib/analytics-server";
import {
  AI_PROVIDERS,
  esModeloDeTexto,
  providerMeta,
  type AiProviderId,
  type AiSettings,
} from "@/lib/ai-providers";
import { verifyApiKey } from "@/lib/ai-verify";
import { aplicarRoles, validarRoles } from "@/lib/ai-roles";
import { encryptSecret } from "@/lib/secrets";
import { invalidarCache } from "@/lib/data-cache";
import { ROLES } from "@/lib/permisos";
import { asignarRol } from "@/app/panel/(app)/configuracion/roles-actions";
import { getRolesPropios } from "@/lib/roles-server";
import { vectorizarPendientes } from "@/lib/vectorizar";
import { registrarClaveDeRespaldo } from "@/lib/embeddings";

/** Guarda la identidad del sitio y refresca TODO el portal, que la consume. */
export async function saveSiteIdentity(formData: FormData) {
  await requireRole("administrador");

  const identity: SiteIdentity = {
    name: String(formData.get("name") ?? "").trim(),
    tagline: String(formData.get("tagline") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    domain: String(formData.get("domain") ?? "").trim().replace(/^https?:\/\//, ""),
    radioStreamUrl: String(formData.get("radioStreamUrl") ?? "").trim(),
  };
  if (identity.radioStreamUrl && !/^https?:\/\//.test(identity.radioStreamUrl)) {
    throw new Error("La URL de la emisora debe empezar por http:// o https://");
  }
  if (!identity.name) throw new Error("El nombre del sitio no puede quedar vacío.");

  await db
    .insert(siteSettings)
    .values({ key: SITE_IDENTITY_KEY, value: identity })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: identity, updatedAt: sql`now()` },
    });

  // El nombre y el lema salen en cabecera, pie y metadatos de todas las rutas.
  invalidarCache();
  revalidatePath("/", "layout");
  revalidatePath("/panel/configuracion");
}

/**
 * Cambia el rol de un usuario. Solo administradores y nunca sobre uno mismo:
 * quitarse el propio rol dejaría el panel sin administrador si es el único.
 */
export async function changeUserRole(userId: string, role: UserRole) {
  const me = await requireRole("administrador");
  if (me.id === userId) throw new Error("No puedes cambiar tu propio rol.");

  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
  revalidatePath("/panel/configuracion");
}

/** Activa o desactiva el acceso de un usuario (no borra su historial). */
export async function toggleUserActive(userId: string, active: boolean) {
  const me = await requireRole("administrador");
  if (me.id === userId) throw new Error("No puedes desactivar tu propia cuenta.");

  await db.update(users).set({ active, updatedAt: new Date() }).where(eq(users.id, userId));
  revalidatePath("/panel/configuracion");
}

/**
 * Elimina una cuenta para siempre. Solo administradores y nunca la propia
 * (se quedaría el panel sin nadie que pueda gestionarlo). Lo que la persona
 * creó se conserva: artículos, borradores y ediciones solo pierden el autor
 * interno (`set null`); sus sesiones y passkeys se borran con ella (`cascade`).
 */
export async function deleteUser(userId: string): Promise<{ ok: boolean; message: string }> {
  const me = await requireRole("administrador");
  if (me.id === userId) return { ok: false, message: "No puedes eliminar tu propia cuenta." };

  const borrados = await db.delete(users).where(eq(users.id, userId)).returning({ id: users.id });
  if (borrados.length === 0) return { ok: false, message: "Esa cuenta ya no existe." };
  await guardarAjustes((m) => {
    delete m[userId];
  });
  revalidatePath("/panel/configuracion");
  return { ok: true, message: "Cuenta eliminada." };
}

/** Lee, modifica y guarda el mapa de ajustes por persona (site_settings). */
async function guardarAjustes(mut: (m: MapaAjustes) => void) {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, PERMISOS_KEY)).limit(1);
  const v = row?.value;
  const mapa: MapaAjustes = v && typeof v === "object" && !Array.isArray(v) ? { ...(v as MapaAjustes) } : {};
  mut(mapa);
  await db
    .insert(siteSettings)
    .values({ key: PERMISOS_KEY, value: mapa })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: mapa, updatedAt: sql`now()` } });
}

/**
 * Enciende o apaga un permiso para UNA persona. Solo administradores; nunca
 * sobre otro administrador (siempre tiene todo) ni sobre uno mismo. Solo se
 * guarda la diferencia con lo que ya da su rol, así cambiar el rol después
 * no deja ajustes huérfanos.
 */
export async function setUserPermission(userId: string, permiso: string, valor: boolean): Promise<{ ok: boolean; message: string }> {
  const me = await requireRole("administrador");
  if (permiso !== DOS_PASOS && !PERMISO_IDS.includes(permiso)) return { ok: false, message: "Permiso desconocido." };
  if (me.id === userId) return { ok: false, message: "No puedes cambiar tus propios permisos." };
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return { ok: false, message: "Esa cuenta ya no existe." };
  if (u.role === "administrador") return { ok: false, message: "Un administrador siempre tiene todos los permisos." };

  const id = permiso as PermisoId;
  await guardarAjustes((m) => {
    const a = { ...(m[userId] ?? {}) } as Record<string, boolean>;
    const base = permiso === DOS_PASOS ? true : porDefecto(u.role, id);
    if (valor === base) delete a[permiso];
    else a[permiso] = valor;
    if (Object.keys(a).length === 0) delete m[userId];
    else m[userId] = a;
  });
  revalidatePath("/panel", "layout");
  return { ok: true, message: "Permiso guardado." };
}

/**
 * Quita el 2FA de una cuenta (teléfono perdido o cambiado). La persona tendrá
 * que volver a activarlo al entrar, salvo que esté exenta. Solo administradores;
 * para el tuyo usa Seguridad de mi cuenta.
 */
export async function resetUserTotp(userId: string): Promise<{ ok: boolean; message: string }> {
  const me = await requireRole("administrador");
  if (me.id === userId) return { ok: false, message: "Para tu cuenta usa Seguridad de mi cuenta." };
  await db.update(users).set({ totpEnabled: false, totpSecret: null, updatedAt: new Date() }).where(eq(users.id, userId));
  revalidatePath("/panel/configuracion");
  return { ok: true, message: "2FA quitado." };
}

/** Vuelve a los permisos que da el rol, sin ajustes. */
export async function resetUserPermissions(userId: string): Promise<void> {
  await requireRole("administrador");
  await guardarAjustes((m) => {
    delete m[userId];
  });
  revalidatePath("/panel", "layout");
}

/**
 * Fija la cuota mensual de IA (USD). `userId` null = la predeterminada de todos;
 * `usd` null = quitar el tope (predeterminada) o dejar sin límite. Solo administradores.
 */
export async function setAiQuota(userId: string | null, usd: number | null): Promise<{ ok: boolean; message: string }> {
  await requireRole("administrador");
  if (usd !== null && (!Number.isFinite(usd) || usd < 0 || usd > 100000)) {
    return { ok: false, message: "Escribe un monto en dólares entre 0 y 100000." };
  }
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, CUOTAS_KEY)).limit(1);
  const v = (row?.value ?? {}) as Partial<Cuotas>;
  const c: Cuotas = { predeterminada: typeof v.predeterminada === "number" ? v.predeterminada : null, personas: { ...(v.personas ?? {}) } };
  const monto = usd === null ? null : Math.round(usd * 100) / 100;
  if (userId === null) c.predeterminada = monto;
  else if (monto === null) delete c.personas[userId];
  else c.personas[userId] = monto;
  await db
    .insert(siteSettings)
    .values({ key: CUOTAS_KEY, value: c })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: c, updatedAt: sql`now()` } });
  revalidatePath("/panel/configuracion");
  return { ok: true, message: "Cuota guardada." };
}

/** Presupuesto mensual (USD), tope de consultas por sesión del asistente público y tope diario de borradores de IA. Solo administradores. */
export async function saveAssistantLimits(presupuesto: number, tope: number, topeBorradoresDia: number): Promise<{ ok: boolean; message: string }> {
  await requireRole("administrador");
  if (!Number.isFinite(presupuesto) || presupuesto < 0 || presupuesto > 1_000_000) {
    return { ok: false, message: "El presupuesto debe ser un monto en dólares entre 0 y 1.000.000." };
  }
  if (!Number.isInteger(tope) || tope < 1 || tope > 1000) {
    return { ok: false, message: "El tope por sesión debe ser un número entero entre 1 y 1000." };
  }
  if (!Number.isInteger(topeBorradoresDia) || topeBorradoresDia < 0 || topeBorradoresDia > 500) {
    return { ok: false, message: "El tope diario de borradores de IA debe ser un entero entre 0 y 500 (0 los suspende)." };
  }
  const value = { presupuestoMensualUsd: Math.round(presupuesto * 100) / 100, topePorSesion: tope, topeBorradoresDia };
  await db
    .insert(siteSettings)
    .values({ key: LIMITES_KEY, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: sql`now()` } });
  revalidatePath("/panel/configuracion");
  return { ok: true, message: "Límites guardados." };
}

// Estado que se devuelve al formulario: si salió bien y el mensaje.
export type CreateUserState = { ok: boolean; message: string } | null;

/**
 * Alta de una persona nueva, con contraseña temporal que se le entrega a
 * mano (por ningún canal automático: no hay envío de correo configurado).
 * La persona la cambia por una propia en Configuración → Mis datos
 * (`actualizarMiPerfil`, que pide la contraseña actual); al administrador le
 * queda comunicarle la temporal de forma segura.
 */
export async function createUser(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  await requireRole("administrador");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const pedido = String(formData.get("role") ?? "redactor");
  // Un rol propio llega como `rol:<id>`: la cuenta nace con su rol base y luego se le aplica la plantilla.
  const propio = pedido.startsWith("rol:") ? (await getRolesPropios()).find((r) => r.id === pedido.slice(4)) : undefined;
  const role = (propio ? propio.base : pedido) as UserRole;

  if (!name) return { ok: false, message: "Falta el nombre." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Correo inválido." };
  if (password.length < 10) return { ok: false, message: "La contraseña debe tener al menos 10 caracteres." };
  if (!ROLES.includes(role)) return { ok: false, message: "Rol inválido." };

  const [existente] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existente) return { ok: false, message: "Ya existe una cuenta con ese correo." };

  const passwordHash = await bcrypt.hash(password, 10);
  const [nueva] = await db.insert(users).values({ name, email, passwordHash, role }).returning({ id: users.id });
  // Rol propio, o rol de siempre con los cambios que se le hayan hecho.
  if (nueva && role !== "administrador") await asignarRol(nueva.id, propio ? `rol:${propio.id}` : role);

  revalidatePath("/panel/configuracion");
  return { ok: true, message: `Cuenta creada para ${name}. Comparte la contraseña de forma segura.` };
}

// Estado que se devuelve al formulario: si salió bien y el mensaje.
export type MiPerfilState = { ok: boolean; message: string } | null;

/**
 * Cada persona edita sus propios datos (nombre, correo, contraseña) — nadie
 * más, ni siquiera un administrador: por eso usa `auth()` y el id de la
 * sesión, no un `userId` que llegara del formulario. Cambiar la contraseña
 * pide la actual para confirmarla; si alguien deja la sesión abierta en un
 * equipo compartido, esa comprobación es lo único que evita que cualquiera
 * se la cambie por otra.
 */
export async function actualizarMiPerfil(_prev: MiPerfilState, formData: FormData): Promise<MiPerfilState> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: "Sesión expirada, vuelve a entrar." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const passwordActual = String(formData.get("currentPassword") ?? "");
  const passwordNueva = String(formData.get("newPassword") ?? "");

  if (!name) return { ok: false, message: "Falta el nombre." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Correo inválido." };

  const [yo] = await db.select().from(users).where(eq(users.id, session.user.id));
  if (!yo) return { ok: false, message: "Tu cuenta ya no existe." };

  if (email !== yo.email) {
    const [existente] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existente) return { ok: false, message: "Ya existe otra cuenta con ese correo." };
  }

  const cambios: Partial<typeof users.$inferInsert> = { name, email, updatedAt: new Date() };

  if (passwordNueva) {
    if (passwordNueva.length < 10) {
      return { ok: false, message: "La contraseña nueva debe tener al menos 10 caracteres." };
    }
    if (!yo.passwordHash || !(await bcrypt.compare(passwordActual, yo.passwordHash))) {
      return { ok: false, message: "La contraseña actual no es correcta." };
    }
    cambios.passwordHash = await bcrypt.hash(passwordNueva, 10);
  }

  await db.update(users).set(cambios).where(eq(users.id, session.user.id));
  revalidatePath("/panel/configuracion");
  return { ok: true, message: "Datos actualizados." };
}

/** Lee los ajustes de IA guardados (o vacíos). */
async function leerAjustesIA(): Promise<Partial<AiSettings>> {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, SECRETS_KEY)).limit(1);
  return (row?.value as Partial<AiSettings> | undefined) ?? {};
}

/** Guarda los ajustes de IA completos (un solo registro en `site_settings`). */
async function escribirAjustesIA(value: AiSettings) {
  await db.insert(siteSettings).values({ key: SECRETS_KEY, value }).onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: sql`now()` } });
  revalidatePath("/panel/configuracion");
}

/**
 * Guarda la clave de UN proveedor, CIFRADA (AES-256-GCM, ver `src/lib/secrets.ts`), después de comprobarla con el propio proveedor y de leer su
 * catálogo real de modelos. La clave no vuelve nunca al navegador: la pantalla solo muestra una máscara. Cada proveedor conserva la suya.
 */
export async function guardarClaveIA(provider: AiProviderId, clave: string): Promise<{ ok: boolean; message: string }> {
  await requireRole("administrador");
  if (!AI_PROVIDERS.some((p) => p.id === provider)) return { ok: false, message: "Proveedor no reconocido." };
  const raw = String(clave ?? "").trim();
  // Se pregunta al proveedor en vez de adivinar por el prefijo: Google emite varios formatos de clave y rechazar por forma bloquea claves válidas.
  if (/\s/.test(raw) || raw.length < 20) return { ok: false, message: "La clave parece incompleta o trae espacios al pegarla." };
  const check = await verifyApiKey(provider, raw);
  if (!check.ok) return { ok: false, message: check.error };

  const actual = await leerAjustesIA();
  const meta = providerMeta(provider);
  const modelos = { ...(actual.models ?? {}), ...(check.models.length > 0 ? { [provider]: check.models } : {}) };
  // Primera clave guardada: ese proveedor pasa a ser el principal, con su primer modelo de texto, para que el sistema ya funcione.
  const primera = !actual.keys || Object.keys(actual.keys).length === 0;
  const modeloInicial = check.models.find(esModeloDeTexto) ?? meta.defaultModel;
  await escribirAjustesIA({
    provider: primera ? provider : (actual.provider ?? provider),
    model: primera ? modeloInicial : (actual.model ?? modeloInicial),
    ...(actual.chartModel ? { chartModel: actual.chartModel } : {}),
    ...(actual.imageModel ? { imageModel: actual.imageModel } : {}),
    ...(actual.roles ? { roles: actual.roles } : {}),
    keys: { ...(actual.keys ?? {}), [provider]: encryptSecret(raw) },
    models: modelos,
  });
  return { ok: true, message: `Clave de ${meta.label} guardada. Modelos disponibles en tu cuenta: ${check.models.length}.` };
}

/** Vuelve a leer del proveedor la lista de modelos de la cuenta, con la clave que ya hay (del entorno o guardada). */
export async function actualizarCatalogoIA(provider: AiProviderId): Promise<{ ok: boolean; message: string }> {
  await requireRole("administrador");
  const key = await claveEfectiva(provider);
  if (!key) return { ok: false, message: "Este proveedor no tiene clave." };
  const check = await verifyApiKey(provider, key);
  if (!check.ok) return { ok: false, message: check.error };
  const actual = await leerAjustesIA();
  await escribirAjustesIA({
    provider: actual.provider ?? provider,
    model: actual.model ?? (check.models.find(esModeloDeTexto) ?? providerMeta(provider).defaultModel),
    ...(actual.chartModel ? { chartModel: actual.chartModel } : {}),
    ...(actual.imageModel ? { imageModel: actual.imageModel } : {}),
    ...(actual.roles ? { roles: actual.roles } : {}),
    keys: actual.keys ?? {},
    models: { ...(actual.models ?? {}), [provider]: check.models },
  });
  return { ok: true, message: `${check.models.length} modelos disponibles en tu cuenta.` };
}

/** Borra la clave guardada de un proveedor (la del entorno no se toca) y conserva todo lo demás. */
export async function eliminarClaveIA(provider: AiProviderId): Promise<{ ok: boolean; message: string }> {
  await requireRole("administrador");
  const actual = await leerAjustesIA();
  const keys = { ...(actual.keys ?? {}) };
  delete keys[provider];
  await escribirAjustesIA({
    provider: actual.provider ?? "anthropic",
    model: actual.model ?? providerMeta(provider).defaultModel,
    ...(actual.chartModel ? { chartModel: actual.chartModel } : {}),
    ...(actual.imageModel ? { imageModel: actual.imageModel } : {}),
    ...(actual.roles ? { roles: actual.roles } : {}),
    keys,
    models: actual.models ?? {},
  });
  return { ok: true, message: "Clave eliminada." };
}

/**
 * Guarda el modelo de cada función: la LISTA de modelos de los editores (con su predeterminado), el agente de la vaca, las imágenes y los dos de
 * videos. Se valida contra el catálogo de cada proveedor y contra las claves guardadas (o del entorno).
 */
export async function guardarModelosIA(entrada: unknown): Promise<{ ok: boolean; message: string }> {
  await requireRole("administrador");
  const actual = await leerAjustesIA();
  const conClave = AI_PROVIDERS.filter((p) => Boolean(actual.keys?.[p.id]) || Boolean(process.env[p.envVar])).map((p) => p.id);
  const v = validarRoles(entrada, actual.models ?? {}, conClave);
  if (!v.ok) return { ok: false, message: v.error };
  await escribirAjustesIA(aplicarRoles(actual, v));
  return { ok: true, message: "Modelos guardados." };
}

/**
 * Analítica y SEO: identificador de GA4 (público, va en el HTML del portal) y
 * clave de PageSpeed Insights (se guarda cifrada, como la del modelo).
 *
 * La clave nueva se comprueba contra la API antes de guardarla: una clave que
 * Google rechaza no debe quedarse en la base de datos.
 */
export async function saveAnalyticsSettings(formData: FormData) {
  await requireRole("administrador");

  const ga4Id = String(formData.get("ga4Id") ?? "").trim();
  if (ga4Id && !GA4_ID_RE.test(ga4Id)) {
    throw new Error("El identificador de GA4 tiene la forma G-XXXXXXXXXX.");
  }

  const gtmId = String(formData.get("gtmId") ?? "").trim();
  if (gtmId && !GTM_ID_RE.test(gtmId)) {
    throw new Error("El contenedor de GTM tiene la forma GTM-XXXXXXX.");
  }

  const searchConsoleToken = String(formData.get("searchConsoleToken") ?? "")
    .trim()
    .replace(/^<meta[^>]*content=["']?([^"'>\s]+).*$/i, "$1");

  const publicBaseUrl = String(formData.get("publicBaseUrl") ?? "")
    .trim()
    .replace(/\/$/, "");
  if (publicBaseUrl && !/^https?:\/\//.test(publicBaseUrl)) {
    throw new Error("La base pública debe empezar por http:// o https://");
  }

  const actual = await readAnalytics();
  const nueva = String(formData.get("psiKey") ?? "").trim();

  let psiKey = actual.psiKey;
  if (nueva) {
    const res = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fexample.com&category=seo&key=${encodeURIComponent(nueva)}`,
      { cache: "no-store" },
    );
    if (res.status === 400 || res.status === 403) {
      const detalle = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new Error(
        detalle?.error?.message
          ? `Google rechazó la clave: ${detalle.error.message.slice(0, 200)}`
          : "Google rechazó la clave de PageSpeed Insights.",
      );
    }
    psiKey = encryptSecret(nueva);
  }

  const value: AnalyticsSettings = { ga4Id, psiKey, publicBaseUrl, gtmId, searchConsoleToken };
  await db
    .insert(siteSettings)
    .values({ key: ANALYTICS_KEY, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: sql`now()` } });

  // El script de GA4 se inyecta en el layout público.
  invalidarCache();
  revalidatePath("/", "layout");
  revalidatePath("/panel/configuracion");
}

/** Vectoriza ahora un lote de notas sin vector (el mismo trabajo del cron), para ver el avance o el error exacto desde el panel. */
export async function vectorizarAhora(): Promise<{ ok: boolean; message: string; hechas: number; pendientes: number }> {
  await requireRole("administrador");
  registrarClaveDeRespaldo((proveedor) => claveEfectiva(proveedor === "openai" ? "openai" : "google"));
  try {
    const r = await vectorizarPendientes(45_000);
    return {
      ok: r.ok,
      hechas: r.hechas,
      pendientes: r.pendientes,
      message: r.ok ? `Listo: ${r.hechas} notas vectorizadas en esta tanda.` : (r.motivo ?? "No se pudo vectorizar."),
    };
  } catch (e) {
    return { ok: false, hechas: 0, pendientes: -1, message: `Error: ${(e as Error)?.message?.slice(0, 300) ?? "desconocido"}` };
  }
}
