import test, { before } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

let bd: typeof import("@/db");
let esq: typeof import("@/db/schema");
let log: typeof import("@/lib/login-log");
let perm: typeof import("@/lib/permisos-server");

before(async () => {
  await prepararBd();
  bd = await import("@/db");
  esq = await import("@/db/schema");
  log = await import("@/lib/login-log");
  perm = await import("@/lib/permisos-server");
});

const crearUsuario = async (email: string) => (await bd.db.insert(esq.users).values({ email, name: "Prueba", role: "editor" }).returning({ id: esq.users.id }))[0].id;

// Postgres envuelve el error de la restricción: se busca su nombre en la cadena de causas.
const rechaza = (nombre: string) => (e: unknown) => {
  for (let c: unknown = e; c; c = (c as { cause?: unknown }).cause) if (String((c as { message?: string }).message ?? "").includes(nombre)) return true;
  return false;
};

test("los accesos se guardan en su tabla, el más reciente primero, y se depuran los que superan la retención", async () => {
  const id = await crearUsuario("accesos@x.co");
  await bd.db.insert(esq.loginEvents).values({ at: new Date(Date.now() - 200 * 86_400_000), userId: id, name: "Vieja", email: "accesos@x.co", role: "editor", metodo: "passkey" });
  await log.registrarAcceso({ userId: id, name: "Prueba", email: "accesos@x.co", role: "editor", metodo: "contraseña", ip: "1.2.3.4", dispositivo: "Chrome · macOS" });
  await log.registrarAcceso({ userId: id, name: "Prueba", email: "accesos@x.co", role: "editor", metodo: "passkey", ip: "1.2.3.4", dispositivo: "Safari · iOS" });
  const accesos = await log.getAccesos(10);
  assert.deepEqual(accesos.map((a) => a.metodo), ["passkey", "contraseña"], "la entrada de hace 200 días ya no está");
  assert.equal(accesos[0].userId, id);
  assert.equal(accesos[0].dispositivo, "Safari · iOS");
});

test("los permisos y el plazo de 2FA se leen de sus tablas y se borran con la cuenta", async () => {
  const id = await crearUsuario("permisos@x.co");
  await bd.db.insert(esq.userPermissionOverrides).values([
    { userId: id, permiso: "publicar", valor: true },
    { userId: id, permiso: "exigir_2fa", valor: false },
  ]);
  const hasta = new Date("2026-12-01T12:00:00Z");
  await bd.db.insert(esq.user2faGrace).values({ userId: id, until: hasta });
  assert.deepEqual((await perm.getAjustes())[id], { publicar: true, exigir_2fa: false });
  assert.equal((await perm.getPlazos2fa())[id], hasta.toISOString());

  await bd.db.delete(esq.users).where(eq(esq.users.id, id));
  assert.equal((await perm.getAjustes())[id], undefined, "sin entradas huérfanas");
  assert.equal((await perm.getPlazos2fa())[id], undefined);
});

test("al eliminar una cuenta su bitácora se conserva sin vínculo", async () => {
  const id = await crearUsuario("baja@x.co");
  await log.registrarAcceso({ userId: id, name: "Baja", email: "baja@x.co", role: "editor", metodo: "contraseña", ip: "", dispositivo: "" });
  await bd.db.delete(esq.users).where(eq(esq.users.id, id));
  const fila = (await log.getAccesos(50)).find((a) => a.email === "baja@x.co");
  assert.ok(fila, "la fila sigue");
  assert.equal(fila.userId, "");
});

test("un permiso repetido para la misma cuenta se actualiza, no se duplica", async () => {
  const id = await crearUsuario("upsert@x.co");
  const t = esq.userPermissionOverrides;
  const guardar = (valor: boolean) =>
    bd.db.insert(t).values({ userId: id, permiso: "portada", valor }).onConflictDoUpdate({ target: [t.userId, t.permiso], set: { valor, updatedAt: sql`now()` } });
  await guardar(true);
  await guardar(false);
  const filas = await bd.db.select().from(t).where(eq(t.userId, id));
  assert.equal(filas.length, 1);
  assert.equal(filas[0].valor, false);
});

test("la base rechaza datos que la aplicación nunca debería producir", async () => {
  const nota = (extra: Record<string, unknown>) => bd.db.insert(esq.articles).values({ slug: "ok", title: "T", excerpt: "e", body: "b", ...extra });
  await assert.rejects(nota({ slug: "Mala_Dirección" }), rechaza("articles_slug_formato"));
  await assert.rejects(nota({ slug: "vacia-1", title: "   " }), rechaza("articles_titulo_no_vacio"));
  await assert.rejects(nota({ slug: "vistas-1", views: -1 }), rechaza("articles_views_no_negativas"));
  await assert.rejects(nota({ slug: "sin-fecha-1", status: "publicado" }), rechaza("articles_publicada_con_fecha"));
  await assert.doesNotReject(nota({ slug: "buena-1", status: "publicado", publishedAt: new Date() }));

  await assert.rejects(bd.db.insert(esq.users).values({ email: "Mayus@X.co", name: "n" }), rechaza("users_email_minusculas"));
  await assert.rejects(bd.db.insert(esq.redirects).values({ fromPath: "/a", toPath: "/b", statusCode: 200 }), rechaza("redirects_codigo"));
  await assert.rejects(bd.db.insert(esq.redirects).values({ fromPath: "/c", toPath: "/c" }), rechaza("redirects_sin_bucle"));
  await assert.rejects(bd.db.insert(esq.redirects).values({ fromPath: "sin-barra", toPath: "/d" }), rechaza("redirects_origen_absoluto"));
  await assert.rejects(bd.db.insert(esq.apiClients).values({ name: "n", keyHash: "h", keyPrefix: "p", requestsPerHour: 0 }), rechaza("api_clients_limite_positivo"));
  await assert.rejects(bd.db.insert(esq.newsletterEditions).values({ subject: "s", status: "rara" }), rechaza("newsletter_editions_estado"));
  await assert.rejects(bd.db.insert(esq.loginEvents).values({ name: "n", email: "e", role: "r", metodo: "otro" }), rechaza("login_events_metodo"));
});
