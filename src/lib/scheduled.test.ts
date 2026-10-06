import test, { before } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

let sched: typeof import("@/lib/scheduled");
let bd: typeof import("@/db");
let articles: typeof import("@/db/schema").articles;
let eventos: typeof import("@/lib/eventos");

before(async () => {
  await prepararBd();
  sched = await import("@/lib/scheduled");
  bd = await import("@/db");
  articles = (await import("@/db/schema")).articles;
  eventos = await import("@/lib/eventos");
});

const nota = (slug: string, extra: Record<string, unknown>) => ({ slug, title: slug, excerpt: "e", body: "<p>b</p>", ...extra });
const estado = async (slug: string) => (await bd.db.select({ s: articles.status, p: articles.publishedAt }).from(articles).where(eq(articles.slug, slug)))[0];

test("solo pasan a publicado las notas programadas cuya hora ya llegó, con su hora como fecha de publicación", async () => {
  const hace = new Date(Date.now() - 3600_000);
  const dentro = new Date(Date.now() + 3600_000);
  await bd.db.insert(articles).values([
    nota("vencida", { status: "programado", scheduledFor: hace }),
    nota("futura", { status: "programado", scheduledFor: dentro }),
    nota("borrador", { status: "borrador" }),
  ]);
  const anunciados: string[][] = [];
  const baja = eventos.alOcurrir("nota.publicada", ({ ids }) => void anunciados.push(ids));
  const log = console.error;
  console.error = () => {}; // fuera de Next, revalidatePath lanza: la promoción no debe depender de ello
  try {
    const r = await sched.procesarProgramadas({ forzar: true });
    assert.deepEqual(r.slugs, ["vencida"]);
    assert.equal(anunciados.length, 1, "se anuncia nota.publicada para que reaccionen los avisos push");
  } finally {
    console.error = log;
    baja();
  }
  assert.equal((await estado("vencida")).s, "publicado");
  assert.equal((await estado("vencida")).p?.getTime(), hace.getTime());
  assert.equal((await estado("futura")).s, "programado");
  assert.equal((await estado("borrador")).s, "borrador");
});

test("es idempotente y dos pasadas a la vez no publican dos veces", async () => {
  await bd.db.insert(articles).values(nota("carrera", { status: "programado", scheduledFor: new Date(Date.now() - 1000) }));
  const log = console.error;
  console.error = () => {};
  try {
    const [a, b] = await Promise.all([sched.procesarProgramadas({ forzar: true }), sched.procesarProgramadas({ forzar: true })]);
    assert.equal(a.slugs.length + b.slugs.length, 1);
    assert.deepEqual((await sched.procesarProgramadas({ forzar: true })).slugs, []);
  } finally {
    console.error = log;
  }
});

test("sin forzar, el sitio no hace más de una pasada por minuto", async () => {
  await bd.db.insert(articles).values(nota("limitada", { status: "programado", scheduledFor: new Date(Date.now() - 1000) }));
  const log = console.error;
  console.error = () => {};
  try {
    await sched.procesarProgramadas(); // consume el cupo del minuto (o ya estaba consumido por otra prueba)
    const segunda = await sched.procesarProgramadas();
    assert.deepEqual(segunda.ids, [], "la segunda llamada dentro del minuto no hace nada");
  } finally {
    console.error = log;
  }
});
