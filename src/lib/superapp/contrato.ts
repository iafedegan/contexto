import { z } from "zod";
import { RUTA_VALIDACION, type ConfigSuperApp } from "./config";

/** Forma del cupón y de la referencia de sesión, según la guía de integración (v1.1). */
export const FORMA_CUPON = /^slc_[A-Za-z0-9_-]{43}$/;
export const FORMA_REFERENCIA = /^srs_[A-Za-z0-9_-]{43}$/;

const TIPOS_DOCUMENTO = ["CC", "CE", "NIT", "PA", "PASSPORT", "TI"] as const;

/** Respuesta de identidad. Los campos de documento y correo se EXIGEN (para rechazar una respuesta incompleta) pero nunca se guardan. */
const respuesta = z.object({
  schemaVersion: z.string().min(1),
  audience: z.string().min(1),
  subject: z.string().min(1).max(256),
  documentType: z.enum(TIPOS_DOCUMENTO),
  documentNumber: z.string().min(1).max(64),
  email: z.string().min(3).max(320),
  active: z.boolean(),
  assuranceLevel: z.number().int().min(0).max(100),
  capabilities: z.array(z.string().max(100)).max(100),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  sessionReference: z.string().regex(FORMA_REFERENCIA),
  sessionValidationUrl: z.string().url(),
  correlationId: z.string().uuid(),
});

/** Lo único de la respuesta que Contexto Ganadero conserva. */
export type IdentidadSuperApp = {
  audience: string;
  subject: string;
  assuranceLevel: number;
  capabilities: string[];
  issuedAt: Date;
  expiresAt: Date;
  sessionReference: string;
  correlationId: string;
};

/**
 * Valida la respuesta del intercambio o de la consulta de sesión contra lo acordado. Rechaza (devuelve `null`) si falta un campo obligatorio, si la
 * versión o el `audience` no coinciden, si la cuenta no está activa, si ya venció, o si `sessionValidationUrl` no apunta al origen y la ruta autorizados
 * (no se sigue una URL que llegue en la respuesta: se usa la configurada).
 */
export function validarRespuesta(json: unknown, cfg: ConfigSuperApp, ahora: Date = new Date()): IdentidadSuperApp | null {
  const r = respuesta.safeParse(json);
  if (!r.success) return null;
  const d = r.data;
  if (d.schemaVersion !== cfg.schemaVersion || d.audience !== cfg.audience || !d.active) return null;
  const expira = new Date(d.expiresAt);
  const emitida = new Date(d.issuedAt);
  if (expira.getTime() <= ahora.getTime() || expira.getTime() <= emitida.getTime()) return null;
  let v: URL;
  try {
    v = new URL(d.sessionValidationUrl);
  } catch {
    return null;
  }
  if (v.origin !== cfg.apiBase || v.pathname !== RUTA_VALIDACION || v.search || v.hash || v.username || v.password) return null;
  return {
    audience: d.audience,
    subject: d.subject,
    assuranceLevel: d.assuranceLevel,
    capabilities: d.capabilities,
    issuedAt: emitida,
    expiresAt: expira,
    sessionReference: d.sessionReference,
    correlationId: d.correlationId,
  };
}

/** Lo mínimo que debe traer la respuesta de la consulta de sesión (la guía no exige repetir la referencia ni la URL). */
const vigencia = z.object({
  audience: z.string().min(1),
  subject: z.string().min(1),
  active: z.boolean(),
  expiresAt: z.string().datetime(),
  correlationId: z.string().uuid(),
});

/** La consulta de sesión confirma a la MISMA persona y al mismo receptor, activa y sin vencer. Devuelve el vencimiento original. */
export function validarVigencia(json: unknown, cfg: ConfigSuperApp, subjectEsperado: string, ahora: Date = new Date()): { expiresAt: Date; correlationId: string } | null {
  const r = vigencia.safeParse(json);
  if (!r.success) return null;
  const d = r.data;
  if (d.audience !== cfg.audience || d.subject !== subjectEsperado || !d.active) return null;
  const expira = new Date(d.expiresAt);
  if (expira.getTime() <= ahora.getTime()) return null;
  return { expiresAt: expira, correlationId: d.correlationId };
}
