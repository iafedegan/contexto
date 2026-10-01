"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { siteSettings, users, type UserRole } from "@/db/schema";
import { CUOTAS_KEY, type Cuotas } from "@/lib/ai-cuota";
import { DOS_PASOS, PERMISO_IDS, porDefecto, type PermisoId } from "@/lib/permisos";
import { PERMISOS_KEY, type MapaAjustes } from "@/lib/permisos-server";
import { auth, requireRole } from "@/lib/auth";
import { SITE_IDENTITY_KEY, type SiteIdentity } from "@/lib/site-identity";
import { SECRETS_KEY } from "@/lib/ai-provider";
import { ANALYTICS_KEY, GA4_ID_RE, GTM_ID_RE, type AnalyticsSettings } from "@/lib/analytics";
import { readAnalytics } from "@/lib/analytics-server";
import {
  AI_PROVIDERS,
  providerMeta,
  type AiProviderId,
  type AiSettings,
} from "@/lib/ai-providers";
import { verifyApiKey } from "@/lib/ai-verify";
import { encryptSecret } from "@/lib/secrets";

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

export type CreateUserState = { ok: boolean; message: string } | null;

const ROLES: UserRole[] = ["redactor", "editor", "administrador"];

/**
 * Alta de una persona nueva, con contraseña temporal que se le entrega a
 * mano (por ningún canal automático: no hay envío de correo configurado).
 * Se le pide que la cambie luego — no hay pantalla de "cambiar contraseña"
 * todavía, así que por ahora queda como tarea del administrador comunicarla
 * de forma segura.
 */
export async function createUser(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  await requireRole("administrador");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "redactor") as UserRole;

  if (!name) return { ok: false, message: "Falta el nombre." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Correo inválido." };
  if (password.length < 10) return { ok: false, message: "La contraseña debe tener al menos 10 caracteres." };
  if (!ROLES.includes(role)) return { ok: false, message: "Rol inválido." };

  const [existente] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existente) return { ok: false, message: "Ya existe una cuenta con ese correo." };

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ name, email, passwordHash, role });

  revalidatePath("/panel/configuracion");
  return { ok: true, message: `Cuenta creada para ${name}. Comparte la contraseña de forma segura.` };
}

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

/**
 * Guarda proveedor, modelo y —si se envía— la clave, CIFRADA
 * (AES-256-GCM, ver `src/lib/secrets.ts`). La clave no vuelve nunca al
 * navegador: la pantalla solo muestra una máscara.
 *
 * Las claves de cada proveedor se conservan por separado, así cambiar de
 * Claude a Gemini y volver no obliga a reintroducirlas.
 */
export async function saveAiSettings(formData: FormData) {
  await requireRole("administrador");

  const provider = String(formData.get("provider") ?? "anthropic") as AiProviderId;
  if (!AI_PROVIDERS.some((p) => p.id === provider)) {
    throw new Error("Proveedor no reconocido.");
  }
  const meta = providerMeta(provider);
  const model = String(formData.get("model") ?? "").trim();
  const chartModel = String(formData.get("chartModel") ?? "").trim();
  const raw = String(formData.get("apiKey") ?? "").trim();

  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, SECRETS_KEY))
    .limit(1);
  const current = (row?.value as Partial<AiSettings> | undefined) ?? {};
  const keys = { ...(current.keys ?? {}) };
  const models = { ...(current.models ?? {}) };

  if (raw) {
    // Se pregunta al proveedor en vez de adivinar por el prefijo: Google emite
    // varios formatos de clave y rechazar por forma bloquea claves válidas.
    if (/\s/.test(raw) || raw.length < 20) {
      throw new Error("La clave parece incompleta o trae espacios al pegarla.");
    }
    const check = await verifyApiKey(provider, raw);
    if (!check.ok) throw new Error(check.error);

    keys[provider] = encryptSecret(raw);
    // Se guarda el catálogo real de la cuenta para ofrecerlo como desplegable:
    // los nombres de modelo caducan y adivinarlos rompe la generación.
    if (check.models.length > 0) models[provider] = check.models;
  }

  const catalogo = models[provider] ?? [];
  const modeloFinal = model || catalogo[0] || meta.defaultModel;
  if (!modeloFinal) {
    throw new Error("Elige un modelo. Guarda primero la clave para ver los disponibles.");
  }
  if (catalogo.length > 0 && !catalogo.includes(modeloFinal)) {
    throw new Error(
      `${meta.label} no ofrece «${modeloFinal}». Disponibles, por ejemplo: ${catalogo.slice(0, 4).join(", ")}.`,
    );
  }

  if (chartModel && catalogo.length > 0 && !catalogo.includes(chartModel)) {
    throw new Error(`${meta.label} no ofrece «${chartModel}» para las gráficas.`);
  }
  const value: AiSettings = {
    provider,
    model: modeloFinal,
    ...(provider === "google" && chartModel ? { chartModel } : {}),
    keys,
    models,
  };
  await db
    .insert(siteSettings)
    .values({ key: SECRETS_KEY, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: sql`now()` } });

  revalidatePath("/panel/configuracion");
}

/** Borra la clave guardada del proveedor activo (la del entorno no se toca). */
export async function deleteApiKey(provider: AiProviderId) {
  await requireRole("administrador");

  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, SECRETS_KEY))
    .limit(1);
  const current = (row?.value as Partial<AiSettings> | undefined) ?? {};
  const keys = { ...(current.keys ?? {}) };
  delete keys[provider];

  const value: AiSettings = {
    provider: current.provider ?? "anthropic",
    model: current.model ?? providerMeta(provider).defaultModel,
    ...(current.chartModel ? { chartModel: current.chartModel } : {}),
    keys,
  };
  await db
    .insert(siteSettings)
    .values({ key: SECRETS_KEY, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: sql`now()` } });

  revalidatePath("/panel/configuracion");
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
  revalidatePath("/", "layout");
  revalidatePath("/panel/configuracion");
}

/** Borra la clave de PageSpeed guardada en el panel (no toca el entorno). */
export async function deletePsiKey() {
  await requireRole("administrador");
  const actual = await readAnalytics();
  const value: AnalyticsSettings = { ...actual, psiKey: null };
  await db
    .insert(siteSettings)
    .values({ key: ANALYTICS_KEY, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: sql`now()` } });
  revalidatePath("/panel/configuracion");
}
