import test from "node:test";
import assert from "node:assert/strict";
import { aLocalBogota, describirCuando, fechaBogota } from "@/lib/newsletter/programacion";

test("la hora escrita se interpreta como hora de Colombia (UTC−5), esté donde esté el servidor", () => {
  assert.equal(fechaBogota("2026-10-15T07:00")?.toISOString(), "2026-10-15T12:00:00.000Z");
  assert.equal(fechaBogota("2026-12-31T23:30")?.toISOString(), "2027-01-01T04:30:00.000Z");
  assert.equal(fechaBogota(" 2026-10-15T00:00 ")?.toISOString(), "2026-10-15T05:00:00.000Z");
});

test("las fechas imposibles o mal escritas se rechazan", () => {
  for (const mala of ["", "mañana", "2026-02-30T10:00", "2026-13-01T10:00", "2026-10-15T25:00", "2026-10-15T07:60", "2026-10-15 07:00", "2026-10-15T07:00:00", "15/10/2026 7:00"]) assert.equal(fechaBogota(mala), null, mala);
  assert.ok(fechaBogota("2028-02-29T10:00"), "2028 es bisiesto");
  assert.equal(fechaBogota("2027-02-29T10:00"), null);
});

test("ida y vuelta, y la frase para mostrar", () => {
  const f = fechaBogota("2026-10-15T07:05")!;
  assert.equal(aLocalBogota(f), "2026-10-15T07:05");
  assert.equal(aLocalBogota(new Date("2026-01-01T03:00:00Z")), "2025-12-31T22:00");
  assert.match(describirCuando(f), /jueves.*15 de octubre de 2026.*7:05/);
});
