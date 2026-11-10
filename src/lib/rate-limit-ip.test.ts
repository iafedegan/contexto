import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIp } from "@/lib/rate-limit";

test("clientIp: manda la IP que pone Vercel, no la primera de x-forwarded-for (que el cliente puede inventar)", () => {
  const h = new Headers({ "x-forwarded-for": "1.2.3.4, 200.1.1.1", "x-real-ip": "200.1.1.1", "x-vercel-forwarded-for": "200.1.1.1" });
  assert.equal(clientIp(h), "200.1.1.1");
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9", "x-real-ip": "200.2.2.2" })), "200.2.2.2");
  // Fuera de Vercel (local) solo queda x-forwarded-for.
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "10.0.0.5" })), "10.0.0.5");
});
