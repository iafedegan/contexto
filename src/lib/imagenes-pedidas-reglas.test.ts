import test from "node:test";
import assert from "node:assert/strict";
import { pedidoDeNota, pendientesPara, puedeEntregarImagen, urlDeImagenValida, type PedidoImagen } from "./imagenes-pedidas-reglas";

const pedido = (p: Partial<PedidoImagen>): PedidoImagen => ({ articleId: "a1", porId: "u1", disenadorId: null, indicaciones: "", estado: "pendiente", fecha: "2026-11-01T10:00:00Z", ...p });

test("entregan la imagen los diseñadores, los editores y los administradores, no los redactores", () => {
  assert.equal(puedeEntregarImagen("disenador"), true);
  assert.equal(puedeEntregarImagen("editor"), true);
  assert.equal(puedeEntregarImagen("administrador"), true);
  assert.equal(puedeEntregarImagen("redactor"), false);
});

test("un diseñador ve los pedidos dirigidos a él y los abiertos, no los de otro diseñador", () => {
  const lista = [pedido({ articleId: "a1" }), pedido({ articleId: "a2", disenadorId: "d1" }), pedido({ articleId: "a3", disenadorId: "d2" }), pedido({ articleId: "a4", estado: "entregada" })];
  assert.deepEqual(pendientesPara(lista, "d1", "disenador").map((p) => p.articleId), ["a1", "a2"]);
  assert.deepEqual(pendientesPara(lista, "e1", "editor").map((p) => p.articleId), ["a1", "a2", "a3"]);
});

test("los pedidos pendientes salen del más antiguo al más nuevo", () => {
  const lista = [pedido({ articleId: "nuevo", fecha: "2026-11-03T00:00:00Z" }), pedido({ articleId: "viejo", fecha: "2026-11-01T00:00:00Z" })];
  assert.deepEqual(pendientesPara(lista, "d1", "disenador").map((p) => p.articleId), ["viejo", "nuevo"]);
});

test("el pedido de una nota se encuentra por su id", () => {
  assert.equal(pedidoDeNota([pedido({ articleId: "x" })], "x")?.articleId, "x");
  assert.equal(pedidoDeNota([], "x"), null);
});

test("solo se acepta una dirección https de largo razonable", () => {
  assert.equal(urlDeImagenValida("https://cdn.ejemplo.co/a.jpg"), true);
  assert.equal(urlDeImagenValida("http://cdn.ejemplo.co/a.jpg"), false);
  assert.equal(urlDeImagenValida("javascript:alert(1)"), false);
  assert.equal(urlDeImagenValida(`https://x.co/${"a".repeat(2000)}`), false);
});
