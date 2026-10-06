import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("la arquitectura modular no tiene dependencias fuera del grafo permitido", () => {
  const r = spawnSync("node", ["scripts/check-modulos.mjs"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});
