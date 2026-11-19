import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mensajeErrorPasskey, nombreEquipo } from "./passkey-errores";

// Errores como los que entrega @simplewebauthn/browser: `code` con el motivo y `name` con el error del navegador.
const error = (name: string, code?: string) => Object.assign(new Error("x"), { name, ...(code ? { code } : {}) });

describe("mensajeErrorPasskey", () => {
  it("un equipo que ya tiene la passkey no se anuncia como «no soporta»", () => {
    const m = mensajeErrorPasskey(error("InvalidStateError", "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED"), "registro", true);
    assert.match(m, /ya tiene una passkey/);
    assert.doesNotMatch(m, /no soporta|no permite/);
  });

  it("cancelar o dejar pasar el tiempo se dice así", () => {
    assert.match(mensajeErrorPasskey(error("NotAllowedError", "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY"), "registro", true), /cancel/);
    assert.match(mensajeErrorPasskey(error("AbortError", "ERROR_CEREMONY_ABORTED"), "ingreso", true), /cancel/);
  });

  it("sin huella, rostro ni PIN explica cómo activar Windows Hello", () => {
    assert.match(mensajeErrorPasskey(error("ConstraintError", "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT"), "registro", true), /Windows Hello/);
  });

  it("solo dice que el navegador no sirve cuando de verdad no tiene WebAuthn", () => {
    assert.doesNotMatch(mensajeErrorPasskey(new Error("raro"), "registro", true), /no permite/);
    assert.match(mensajeErrorPasskey(null, "registro", false), /no permite/);
  });

  it("la dirección equivocada se nombra", () => {
    assert.match(mensajeErrorPasskey(error("SecurityError", "ERROR_INVALID_RP_ID"), "ingreso", true), /contextoganadero\.com/);
  });
});

describe("nombreEquipo", () => {
  it("nombra el sistema del equipo", () => {
    assert.equal(nombreEquipo("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0"), "Windows");
    assert.equal(nombreEquipo("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), "Mac");
    assert.equal(nombreEquipo("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "iPhone/iPad");
    assert.equal(nombreEquipo("Mozilla/5.0 (Linux; Android 15)"), "Android");
  });
});
