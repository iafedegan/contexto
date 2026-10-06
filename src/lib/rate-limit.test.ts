import test, { before } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

let rl: typeof import("@/lib/rate-limit");
let mant: typeof import("@/lib/mantenimiento");
let bd: typeof import("@/db");

before(async () => {
  await prepararBd();
  rl = await import("@/lib/rate-limit");
  mant = await import("@/lib/mantenimiento");
  bd = await import("@/db");
});

test("hit cuenta por clave y ventana, y se rechaza al pasar el tope", async () => {
  const estados = [];
  for (let i = 0; i < 5; i++) estados.push((await rl.hit("prueba:a", 3, 60)).allowed);
  assert.deepEqual(estados, [true, true, true, false, false]);
  assert.equal((await rl.hit("prueba:b", 3, 60)).allowed, true, "otra clave no se ve afectada");
});

test("usoUnico solo concede la primera vez y clearHits lo libera", async () => {
  assert.equal(await rl.usoUnico("uso:x", 60), true);
  assert.equal(await rl.usoUnico("uso:x", 60), false);
  await rl.clearHits("uso:x");
  assert.equal(await rl.usoUnico("uso:x", 60), true);
});

test("la purga borra solo los contadores vencidos hace más de una hora (H-25)", async () => {
  await bd.db.execute(sql`delete from rate_limits`);
  await bd.db.execute(sql`
    insert into rate_limits (key, count, reset_at) values
      ('vencido-hace-2h', 5, now() - interval '2 hours'),
      ('vencido-hace-10min', 5, now() - interval '10 minutes'),
      ('vigente', 5, now() + interval '10 minutes')
  `);
  assert.equal(await rl.purgarLimitesVencidos(), 1);
  const quedan = bd.rowsOf<{ key: string }>(await bd.db.execute(sql`select key from rate_limits order by key`)).map((r) => r.key);
  assert.deepEqual(quedan, ["vencido-hace-10min", "vigente"]);
  assert.equal(await rl.purgarLimitesVencidos(), 0, "idempotente");
});

test("el mantenimiento diario ejecuta cada parte por separado y devuelve su resultado", async () => {
  await bd.db.execute(sql`insert into rate_limits (key, count, reset_at) values ('viejo', 1, now() - interval '3 hours')`);
  delete process.env.SUPABASE_URL;
  const r = await mant.purgarVencidos();
  assert.equal(r.limitesBorrados, 1);
  assert.ok("ipsBorradas" in r.boletin, "la retención del boletín corrió");
  assert.ok("omitida" in r.medios, "sin Supabase, la limpieza de medios se omite sin fallar");
});
