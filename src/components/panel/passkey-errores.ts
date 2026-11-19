/**
 * Qué decirle a la persona cuando el navegador rechaza una passkey. Antes todo error que no fuera «cancelado» se mostraba como «Este navegador
 * no soporta passkeys», también cuando el equipo YA tenía una passkey de la cuenta (el navegador se niega a crear otra igual): la persona
 * creía que su equipo no servía. `@simplewebauthn/browser` deja el motivo en `code` y el error original del navegador en `name`.
 */
export type MomentoPasskey = "registro" | "ingreso";

export function mensajeErrorPasskey(e: unknown, momento: MomentoPasskey, soportado: boolean): string {
  if (!soportado) return "Este navegador no permite passkeys. Usa Chrome, Edge, Safari o Firefox actualizados, o entra con tu contraseña.";
  const code = typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
  const name = e instanceof Error ? e.name : "";
  if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" || name === "InvalidStateError") {
    return momento === "registro"
      ? "Este equipo ya tiene una passkey de tu cuenta: no hace falta otra. Para usarla, en la pantalla de entrada pulsa «Entrar con passkey»."
      : "No se pudo usar la passkey. Inténtalo de nuevo o entra con tu contraseña.";
  }
  if (code === "ERROR_CEREMONY_ABORTED" || name === "NotAllowedError" || name === "AbortError") {
    return momento === "registro"
      ? "No se completó: se canceló la ventana del equipo o pasó el tiempo. Vuelve a intentarlo y confirma con tu huella, rostro o PIN."
      : "No se completó el ingreso con passkey (se canceló o pasó el tiempo). Si este equipo no tiene una passkey de tu cuenta, entra con tu contraseña.";
  }
  if (code === "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT" || code === "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT" || name === "NotSupportedError" || name === "ConstraintError") {
    return "Este equipo no tiene cómo confirmar que eres tú (huella, rostro o PIN). En Windows, activa Windows Hello con un PIN en Configuración › Cuentas › Opciones de inicio de sesión y vuelve a intentarlo.";
  }
  if (code === "ERROR_INVALID_DOMAIN" || code === "ERROR_INVALID_RP_ID" || name === "SecurityError") {
    return "Las passkeys solo funcionan en la dirección oficial del panel (www.contextoganadero.com). Ábrelo desde ahí e inténtalo de nuevo.";
  }
  return momento === "registro"
    ? "No se pudo agregar la passkey. Inténtalo de nuevo; si sigue fallando, prueba con otro navegador."
    : "No se pudo completar el ingreso con passkey. Inténtalo de nuevo o entra con tu contraseña.";
}

/** Nombre con el que queda guardada una passkey nueva: el sistema del equipo (las de Windows Hello sirven en cualquier navegador de ese equipo). */
export function nombreEquipo(ua: string): string {
  if (/iphone|ipad/i.test(ua)) return "iPhone/iPad";
  if (/android/i.test(ua)) return "Android";
  if (/windows/i.test(ua)) return "Windows";
  if (/mac/i.test(ua)) return "Mac";
  if (/cros/i.test(ua)) return "Chromebook";
  if (/linux/i.test(ua)) return "Linux";
  return "Otro equipo";
}
