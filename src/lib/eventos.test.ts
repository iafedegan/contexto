import test from "node:test";
import assert from "node:assert/strict";
import { alOcurrir, emitir } from "@/lib/eventos";

test("emitir entrega la carga a todos los oyentes y se puede dar de baja", () => {
  let recibidos = 0;
  const baja = alOcurrir("nota.publicada", ({ ids }) => { recibidos += ids.length; });
  emitir("nota.publicada", { ids: ["a", "b"] });
  baja();
  emitir("nota.publicada", { ids: ["c"] });
  assert.equal(recibidos, 2);
});

test("un oyente que falla no impide a los demás ni a quien emite", async () => {
  let ok = false;
  const bajas = [
    alOcurrir("nota.publicada", () => { throw new Error("roto"); }),
    alOcurrir("nota.publicada", async () => { throw new Error("roto async"); }),
    alOcurrir("nota.publicada", () => { ok = true; }),
  ];
  const err = console.error;
  console.error = () => {};
  try {
    assert.doesNotThrow(() => emitir("nota.publicada", { ids: ["x"] }));
    await new Promise((r) => setTimeout(r, 10));
  } finally {
    console.error = err;
    bajas.forEach((b) => b());
  }
  assert.equal(ok, true);
});
