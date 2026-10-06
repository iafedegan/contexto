import test, { before } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";

let push: typeof import("@/lib/push");

before(async () => {
  await prepararBd();
  push = await import("@/lib/push");
});

test("una nota avisada queda registrada y las demás no", async () => {
  assert.equal(await push.notaYaAvisada("nota-1"), false);
  await push.registrarNotaAvisada("nota-1");
  assert.equal(await push.notaYaAvisada("nota-1"), true);
  assert.equal(await push.notaYaAvisada("nota-2"), false);
});

test("registrar muchas a la vez no pierde ninguna (antes se leía la lista, se modificaba y se reescribía)", async () => {
  await Promise.all(Array.from({ length: 20 }, (_, i) => push.registrarNotaAvisada(`simultanea-${i}`)));
  for (let i = 0; i < 20; i++) assert.equal(await push.notaYaAvisada(`simultanea-${i}`), true, `simultanea-${i}`);
});

test("repetir el registro de una misma nota no la duplica y la lista se limita a 200", async () => {
  for (let i = 0; i < 3; i++) await push.registrarNotaAvisada("repetida");
  for (let i = 0; i < 210; i++) await push.registrarNotaAvisada(`n${i}`);
  assert.equal(await push.notaYaAvisada("n209"), true, "las más recientes se conservan");
  assert.equal(await push.notaYaAvisada("nota-1"), false, "las más antiguas salen al pasar de 200");
});

test("los avisos solo llegan de servicios de push conocidos", () => {
  assert.equal(push.endpointPushValido("https://fcm.googleapis.com/fcm/send/abc"), true);
  assert.equal(push.endpointPushValido("https://updates.push.services.mozilla.com/wpush/v2/abc"), true);
  assert.equal(push.endpointPushValido("http://fcm.googleapis.com/x"), false);
  assert.equal(push.endpointPushValido("https://169.254.169.254/latest"), false);
  assert.equal(push.endpointPushValido("https://evil.example.com/push"), false);
});
