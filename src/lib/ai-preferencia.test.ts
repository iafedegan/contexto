import test, { before } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";

let pref: typeof import("@/lib/ai-preferencia");
before(async () => {
  await prepararBd();
  pref = await import("@/lib/ai-preferencia");
});

test("cada persona recuerda su modelo favorito y cambiarlo no toca el de las demás", async () => {
  assert.equal(await pref.getModeloFavorito("ana"), null);
  await pref.setModeloFavorito("ana", "google:gemini-3.8-flash");
  await pref.setModeloFavorito("luis", "anthropic:claude-sonnet-5");
  assert.equal(await pref.getModeloFavorito("ana"), "google:gemini-3.8-flash");
  assert.equal(await pref.getModeloFavorito("luis"), "anthropic:claude-sonnet-5");
  await pref.setModeloFavorito("ana", "google:gemini-3.8-pro");
  assert.equal(await pref.getModeloFavorito("ana"), "google:gemini-3.8-pro");
  assert.equal(await pref.getModeloFavorito("luis"), "anthropic:claude-sonnet-5");
});

test("varias elecciones a la vez no se pisan", async () => {
  await Promise.all(["a", "b", "c", "d", "e"].map((u) => pref.setModeloFavorito(`u-${u}`, `google:modelo-${u}`)));
  for (const u of ["a", "b", "c", "d", "e"]) assert.equal(await pref.getModeloFavorito(`u-${u}`), `google:modelo-${u}`);
});
