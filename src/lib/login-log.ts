import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";

/**
 * Bitácora de accesos al panel: quién entró, cuándo, cómo y desde dónde.
 * Vive en `site_settings` (clave `login_log`, las últimas 300 entradas) para no
 * necesitar migración en Supabase. El registro nunca bloquea ni rompe el inicio de sesión.
 */
export const LOGIN_LOG_KEY = "login_log";
// Máximo de accesos que se conservan en el registro.
const MAX = 300;

// Un inicio de sesión registrado: quién, cuándo, con qué método, desde qué IP y dispositivo.
export type AccesoRegistro = {
  at: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  metodo: "contraseña" | "passkey";
  ip: string;
  dispositivo: string;
};

/** «Chrome · macOS» a partir del user-agent (sin guardar la cadena completa). */
export function dispositivoDe(ua: string | null | undefined): string {
  const u = ua ?? "";
  const nav = /Edg\//.test(u) ? "Edge" : /OPR\//.test(u) ? "Opera" : /Firefox\//.test(u) ? "Firefox" : /Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : "Navegador";
  const so = /iPhone|iPad/.test(u) ? "iOS" : /Android/.test(u) ? "Android" : /Mac OS X/.test(u) ? "macOS" : /Windows/.test(u) ? "Windows" : /Linux/.test(u) ? "Linux" : "";
  return so ? `${nav} · ${so}` : nav;
}

// Añade un acceso al registro, que se mantiene acotado; si falla, no interrumpe el inicio de sesión.
export async function registrarAcceso(a: Omit<AccesoRegistro, "at">): Promise<void> {
  try {
    const entrada = JSON.stringify({ ...a, at: new Date().toISOString() });
    // Una sola sentencia atómica: antepone la entrada y recorta a las últimas MAX.
    await db.execute(sql`
      insert into site_settings (key, value, updated_at)
      values (${LOGIN_LOG_KEY}, jsonb_build_array(${entrada}::jsonb), now())
      on conflict (key) do update set
        value = (
          select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
          from jsonb_array_elements(jsonb_build_array(${entrada}::jsonb) || site_settings.value) with ordinality as t(e, i)
          where i <= ${MAX}
        ),
        updated_at = now()
    `);
  } catch (err) {
    console.warn("[login-log] no se pudo registrar el acceso:", err);
  }
}

// Lee los accesos más recientes registrados, hasta el límite pedido.
export async function getAccesos(limit = 100): Promise<AccesoRegistro[]> {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, LOGIN_LOG_KEY)).limit(1);
    return Array.isArray(row?.value) ? (row.value as AccesoRegistro[]).slice(0, limit) : [];
  } catch {
    return [];
  }
}
