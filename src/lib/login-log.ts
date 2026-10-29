import "server-only";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginEvents } from "@/db/schema";

/**
 * Bitácora de accesos al panel: quién entró, cuándo, cómo y desde dónde. Una fila por inicio de sesión en `login_events`.
 * La IP es un dato personal (Ley 1581): los registros se conservan `RETENCION_ACCESOS_DIAS` días y luego se borran.
 * El registro nunca bloquea ni rompe el inicio de sesión.
 */
export const RETENCION_ACCESOS_DIAS = 90;

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

/**
 * Correo enmascarado para los logs del servidor (`ed***@gmail.com`): permite al equipo reconocer la cuenta sin dejar la
 * dirección completa, que es un dato personal, en un sistema de logs con retención ajena (H-20).
 */
export function enmascararCorreo(correo: string | null | undefined): string {
  const c = (correo ?? "").trim();
  const arroba = c.lastIndexOf("@");
  if (arroba < 1) return c ? "***" : "sin correo";
  const local = c.slice(0, arroba);
  return `${local.slice(0, Math.min(2, Math.max(1, local.length - 1)))}***${c.slice(arroba)}`;
}

/** «Chrome · macOS» a partir del user-agent (sin guardar la cadena completa). */
export function dispositivoDe(ua: string | null | undefined): string {
  const u = ua ?? "";
  const nav = /Edg\//.test(u) ? "Edge" : /OPR\//.test(u) ? "Opera" : /Firefox\//.test(u) ? "Firefox" : /Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : "Navegador";
  const so = /iPhone|iPad/.test(u) ? "iOS" : /Android/.test(u) ? "Android" : /Mac OS X/.test(u) ? "macOS" : /Windows/.test(u) ? "Windows" : /Linux/.test(u) ? "Linux" : "";
  return so ? `${nav} · ${so}` : nav;
}

// Añade un acceso al registro y depura los que superan la retención; si falla, no interrumpe el inicio de sesión.
export async function registrarAcceso(a: Omit<AccesoRegistro, "at">): Promise<void> {
  try {
    await db.insert(loginEvents).values({ userId: a.userId, name: a.name, email: a.email, role: a.role, metodo: a.metodo, ip: a.ip, dispositivo: a.dispositivo });
    await db.delete(loginEvents).where(sql`${loginEvents.at} < now() - make_interval(days => ${RETENCION_ACCESOS_DIAS})`);
  } catch (err) {
    console.warn("[login-log] no se pudo registrar el acceso:", err);
  }
}

// Lee los accesos más recientes registrados, hasta el límite pedido.
export async function getAccesos(limit = 100): Promise<AccesoRegistro[]> {
  try {
    const filas = await db.select().from(loginEvents).orderBy(desc(loginEvents.at)).limit(limit);
    return filas.map((f) => ({
      at: f.at.toISOString(),
      userId: f.userId ?? "",
      name: f.name,
      email: f.email,
      role: f.role,
      metodo: f.metodo === "passkey" ? "passkey" : "contraseña",
      ip: f.ip,
      dispositivo: f.dispositivo,
    }));
  } catch {
    return [];
  }
}
