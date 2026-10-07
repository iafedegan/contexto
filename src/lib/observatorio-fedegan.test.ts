import test from "node:test";
import assert from "node:assert/strict";
import { normalizar } from "@/lib/observatorio-fedegan";

test("un valor guardado por una versión anterior (sin documentos) no rompe el Observatorio", () => {
  const viejo = { generales: [], departamental: [], hato: [] };
  assert.deepEqual(normalizar(viejo), { generales: [], departamental: [], hato: [], documentos: [] });
});

test("normalizar tolera vacío y conserva lo que sí trae", () => {
  assert.deepEqual(normalizar(null), { generales: [], departamental: [], hato: [], documentos: [] });
  const docs = [{ codigo: "036", titulo: "Coyuntura", documentos: [] }];
  assert.deepEqual(normalizar({ documentos: docs }).documentos, docs);
});
