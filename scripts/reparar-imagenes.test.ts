import test from "node:test";
import assert from "node:assert/strict";
import { reescribirCuerpo } from "./migracion/reparar-imagenes";

test("reemplaza las imágenes y enlaces de Storyblok por su copia, también con la barra de más", async () => {
  const html = '<p><img src="https:///a.storyblok.com/f/1/ab/tabla.jpg" alt=""> <a href="https://a.storyblok.com/f/1/cd/foto.png/m/">ver</a> <img src="https://otro.com/x.jpg"></p>';
  const r = await reescribirCuerpo(html, async (u) => `https://media.test/${u.split("/").pop()}`);
  assert.equal(r.cambios, 2);
  assert.match(r.html, /src="https:\/\/media\.test\/tabla\.jpg"/);
  assert.match(r.html, /href="https:\/\/media\.test\/foto\.png"/);
  assert.match(r.html, /https:\/\/otro\.com\/x\.jpg/);
});

test("si la copia falla, la nota queda como estaba", async () => {
  const html = '<img src="https://a.storyblok.com/f/1/ab/x.jpg">';
  const r = await reescribirCuerpo(html, async () => null);
  assert.equal(r.cambios, 0);
  assert.equal(r.html, html);
});
