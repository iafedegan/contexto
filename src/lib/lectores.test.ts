import test, { before } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";

let reg: typeof import("@/lib/lectores-registro");
let con: typeof import("@/lib/lectores-consulta");
let fil: typeof import("@/lib/lectores-filtros");
let bd: typeof import("@/db");
let schema: typeof import("@/db/schema");
let nota1: string;
let nota2: string;

const V1 = "11111111-1111-4111-8111-111111111111";
const V2 = "22222222-2222-4222-8222-222222222222";
const V3 = "33333333-3333-4333-8333-333333333333";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36";
const ctx = (ua: string, ciudad = "Bogot%C3%A1", region = "DC") => ({ userAgent: ua, pais: "CO", region, ciudad, host: "contexto.test" });
const inicio = (visitante: string, slug: string, extra: Record<string, unknown> = {}) => ({ visitante, slug, recurrente: false, utm: { utmSource: "", utmMedium: "", utmCampaign: "", referrer: "", ...extra } });

before(async () => {
  await prepararBd();
  reg = await import("@/lib/lectores-registro");
  con = await import("@/lib/lectores-consulta");
  fil = await import("@/lib/lectores-filtros");
  bd = await import("@/db");
  schema = await import("@/db/schema");
  const [u] = await bd.db.insert(schema.users).values({ email: "e@example.com", name: "E", role: "editor", passwordHash: "x" }).returning({ id: schema.users.id });
  const [a] = await bd.db.insert(schema.authors).values({ slug: "redaccion", name: "Redacción" }).returning({ id: schema.authors.id });
  const [cat] = await bd.db.insert(schema.categories).values({ slug: "ganaderia", name: "Ganadería" }).returning({ id: schema.categories.id });
  const base = { excerpt: "r", body: "<p>c</p>", authorId: a.id, createdBy: u.id, categoryId: cat.id, publishedAt: new Date() };
  const [n1] = await bd.db.insert(schema.articles).values({ ...base, slug: "nota-uno", title: "Nota uno", status: "publicado" }).returning({ id: schema.articles.id });
  const [n2] = await bd.db.insert(schema.articles).values({ ...base, slug: "nota-dos", title: "Nota dos", status: "publicado" }).returning({ id: schema.articles.id });
  await bd.db.insert(schema.articles).values({ ...base, slug: "nota-borrador", title: "Borrador", status: "borrador", publishedAt: null });
  nota1 = n1.id;
  nota2 = n2.id;
});

test("una lectura solo se registra para una nota publicada, y un robot no cuenta", async () => {
  assert.equal(await reg.iniciarLectura(inicio(V1, "no-existe"), ctx(MAC)), null);
  assert.equal(await reg.iniciarLectura(inicio(V1, "nota-borrador"), ctx(MAC)), null, "un borrador no se mide");
  assert.equal(await reg.iniciarLectura(inicio(V1, "nota-uno"), ctx("Mozilla/5.0 (compatible; Googlebot/2.1)")), null);
});

test("el avance solo sube y solo lo actualiza quien empezó la lectura", async () => {
  const id = await reg.iniciarLectura(inicio(V1, "nota-uno", { utmSource: "boletin" }), ctx(IPHONE));
  assert.ok(id);
  assert.equal(await reg.registrarProgreso({ visitante: V1, lectura: id, scroll: 60, segundos: 40 }), true);
  assert.equal(await reg.registrarProgreso({ visitante: V1, lectura: id, scroll: 30, segundos: 10 }), true, "un mensaje atrasado no baja el avance");
  assert.equal(await reg.registrarProgreso({ visitante: V2, lectura: id, scroll: 100, segundos: 999 }), false, "otro visitante no puede tocarla");
  const [fila] = await bd.db.select().from(schema.readerSessions);
  assert.equal(fila.maxScroll, 60);
  assert.equal(fila.seconds, 40);
  assert.equal(fila.device, "mobile");
  assert.equal(fila.city, "Bogotá", "la ciudad llega codificada y se guarda legible");
  assert.match(fila.source ?? "", /boletin/i);
});

test("los indicadores, el calor, el embudo y los desgloses responden a los datos y a los filtros", async () => {
  // Base conocida: se vacía y se siembran cuatro lecturas en días y horas precisos (hora de Colombia).
  await bd.db.delete(schema.readerSessions);
  const s = (visitante: string, articleId: string, createdAt: string, extra: Partial<typeof schema.readerSessions.$inferInsert>) =>
    bd.db.insert(schema.readerSessions).values({ visitorId: visitante, articleId, createdAt: new Date(createdAt), device: "mobile", city: "Bogotá", region: "DC", source: "Google", ...extra });
  await s(V1, nota1, "2026-10-05T13:30:00Z", { maxScroll: 100, seconds: 120, returning: false }); // lunes 08:30
  await s(V1, nota2, "2026-10-05T13:40:00Z", { maxScroll: 40, seconds: 15, returning: false }); // lunes 08:40
  await s(V2, nota1, "2026-10-06T01:10:00Z", { device: "desktop", city: "Medellín", region: "ANT", source: "Facebook", maxScroll: 90, seconds: 200, returning: true }); // lunes 20:10 (01:10Z del martes)
  await s(V3, nota1, "2026-10-06T15:00:00Z", { maxScroll: 5, seconds: 3, returning: false }); // martes 10:00
  const f = fil.leerFiltros({ desde: "2026-10-05", hasta: "2026-10-06" }, new Date("2026-10-07T03:00:00Z"));
  const p = await con.panorama(f);

  assert.equal(p.hayLecturas, true);
  assert.equal(p.indicadores.lecturas, 4);
  assert.equal(p.indicadores.visitantes, 3, "V1 leyó dos notas: una persona");
  assert.equal(p.indicadores.completas, 2, "100 % y 90 % llegaron al final");
  assert.equal(p.indicadores.recurrentes, 1);
  assert.equal(p.indicadores.rebotes, 1, "la de 3 s y 5 % es un rebote");
  assert.equal(Math.round(p.indicadores.segundosMedios), 85);
  assert.equal(p.serie.length, 2);
  assert.deepEqual(p.serie.map((d) => [d.dia, d.lecturas]), [["2026-10-05", 3], ["2026-10-06", 1]], "01:10 UTC del martes es lunes por la noche en Colombia… y el martes 10:00 es martes");
  assert.deepEqual(p.embudo.alcance, { lecturas: 4, a25: 3, a50: 2, a75: 2, completas: 2 });
  assert.deepEqual(p.embudo.tiempo.map((t) => t.n), [1, 1, 0, 1, 1], "tramos de tiempo: <10 s (3 s), 10–30 s (15 s), 30–60 s, 1–3 min (120 s), 3 min o más (200 s)");
  assert.deepEqual(p.embudo.frecuencia.map((x) => x.n), [2, 1, 0, 0], "dos visitantes leyeron una nota y uno leyó dos");
  assert.equal(p.calor.find((c) => c.dow === 1 && c.hora === 8)?.n, 2, "lunes a las 8: dos lecturas");
  assert.equal(p.dispositivos.find((d) => d.clave === "mobile")?.lecturas, 3);
  assert.equal(p.ciudades[0].clave, "Bogotá");
  assert.equal(p.notas[0].titulo, "Nota uno");
  assert.equal(p.notas[0].lecturas, 3);
  assert.equal(p.opciones.categorias[0].etiqueta, "Ganadería");

  // Filtros: cada uno encoge lo que muestra, y la lista de opciones del filtro NO se encoge.
  const soloEscritorio = await con.panorama({ ...f, dispositivo: "desktop" });
  assert.equal(soloEscritorio.indicadores.lecturas, 1);
  assert.deepEqual(soloEscritorio.opciones.ciudades.map((c) => c.valor), ["Medellín"], "las opciones se ajustan a los demás filtros (solo hay lectores de escritorio en Medellín)");
  const soloMedellin = await con.panorama({ ...f, ciudad: "Medellín" });
  assert.equal(soloMedellin.indicadores.lecturas, 1);
  assert.equal(soloMedellin.opciones.ciudades.length, 2, "la lista de su propio filtro no se encoge: se puede cambiar de ciudad");
  assert.equal((await con.panorama({ ...f, visitante: "recurrente" })).indicadores.lecturas, 1);
  assert.equal((await con.panorama({ ...f, fuente: "Facebook" })).indicadores.lecturas, 1);
  assert.equal((await con.panorama({ ...f, categoria: "ganaderia" })).indicadores.lecturas, 4);
  assert.equal((await con.panorama({ ...f, categoria: "otra" })).indicadores.lecturas, 0);
  // Periodo anterior: sin datos, todo en cero (no inventa).
  assert.equal(p.anterior.lecturas, 0);
});

test("sin lecturas, el panorama viene en ceros y completo", async () => {
  await bd.db.delete(schema.readerSessions);
  const p = await con.panorama(fil.leerFiltros({ desde: "2026-10-05", hasta: "2026-10-06" }, new Date("2026-10-07T03:00:00Z")));
  assert.equal(p.hayLecturas, false);
  assert.equal(p.indicadores.lecturas, 0);
  assert.equal(p.serie.length, 2);
  assert.deepEqual(p.embudo.frecuencia.map((x) => x.n), [0, 0, 0, 0]);
});

test("la retención borra las lecturas viejas y solo esas", async () => {
  await bd.db.insert(schema.readerSessions).values([
    { visitorId: V1, articleId: nota1, createdAt: new Date(Date.now() - 500 * 86_400_000) },
    { visitorId: V2, articleId: nota1, createdAt: new Date(Date.now() - 10 * 86_400_000) },
  ]);
  assert.equal(await reg.purgarLecturas(400), 1);
  assert.equal((await bd.db.select().from(schema.readerSessions)).length, 1);
});

test("borrar una nota borra sus lecturas", async () => {
  await bd.db.insert(schema.readerSessions).values({ visitorId: V3, articleId: nota2 });
  const antes = (await bd.db.select().from(schema.readerSessions)).length;
  const { eq } = await import("drizzle-orm");
  await bd.db.delete(schema.articles).where(eq(schema.articles.id, nota2));
  assert.equal((await bd.db.select().from(schema.readerSessions)).length, antes - 1);
});

test("el análisis de suscriptores cuenta altas, bajas, confirmación y rangos de edad sin exponer a nadie", async () => {
  const sub = await import("@/lib/suscriptores-consulta");
  await bd.db.delete(schema.newsletterSubscribers);
  const hoy = new Date();
  const hace = (d: number) => new Date(hoy.getTime() - d * 86_400_000);
  const nac = (edad: number) => new Date(hoy.getTime() - edad * 365.25 * 86_400_000).toISOString().slice(0, 10);
  await bd.db.insert(schema.newsletterSubscribers).values([
    { email: "a@gmail.com", confirmed: true, createdAt: hace(2), signupCity: "Bogotá", birthDate: nac(30), mobile: "300" },
    { email: "b@gmail.com", confirmed: true, createdAt: hace(3), signupCity: "Bogotá", birthDate: nac(52) },
    { email: "c@hotmail.com", confirmed: true, createdAt: hace(40), signupCity: "Medellín" },
    { email: "d@empresa.com", confirmed: false, createdAt: hace(1) },
    { email: "e@yahoo.com", confirmed: true, createdAt: hace(5), unsubscribedAt: hace(1) },
  ]);
  // Las fechas son de Colombia (como las de la pantalla): a partir de las 7 p. m. la fecha UTC ya es la de mañana.
  const hastaCo = fil.hoyColombia();
  const desdeCo = new Date(Date.parse(`${hastaCo}T00:00:00Z`) - 9 * 86_400_000).toISOString().slice(0, 10);
  const f = fil.leerFiltros({ desde: desdeCo, hasta: hastaCo });
  const p = await sub.panoramaSuscriptores(f);
  assert.equal(p.resumen.total, 5);
  assert.equal(p.resumen.activos, 3, "confirmados y sin baja");
  assert.equal(p.resumen.pendientes, 1);
  assert.equal(p.resumen.bajas, 1);
  assert.equal(p.resumen.altasPeriodo, 4, "las de los últimos 10 días (la de hace 40 días queda fuera)");
  assert.equal(p.resumen.bajasPeriodo, 1);
  assert.equal(Math.round(p.resumen.confirmacion), 80);
  assert.equal(p.serie.length, 10);
  assert.equal(p.serie[p.serie.length - 1].acumulado, p.serie[0].acumulado + p.serie.reduce((t, d) => t + d.altas, 0) - p.serie[0].altas, "el acumulado suma las altas día a día");
  assert.deepEqual(p.ciudades[0], { clave: "Bogotá", n: 2 });
  assert.deepEqual(p.edades.map((e) => e.clave), ["25 a 34", "45 a 54", "Sin dato"]);
  assert.equal(p.correos.find((c) => c.clave === "Gmail")?.n, 2);
  assert.deepEqual(p.completitud, { edad: 2, ciudad: 3, celular: 1, activos: 3 });
  // Nada de lo devuelto lleva direcciones de correo ni fechas de nacimiento.
  assert.doesNotMatch(JSON.stringify(p), /@gmail|@hotmail|@yahoo|@empresa|19\d\d-\d\d-\d\d/);
});

test("la lectura por suscriptor: solo con autorización, solo desde el vínculo, con verificación y sin dejar rastro tras la baja", async () => {
  const sus = await import("@/lib/lectores-suscriptor");
  const ident = await import("@/lib/lectores-identificados");
  const { eq } = await import("drizzle-orm");
  await bd.db.delete(schema.newsletterSubscribers);
  await bd.db.delete(schema.readerSessions);
  const [nota] = await bd.db.select({ id: schema.articles.id }).from(schema.articles).limit(1);
  const crear = async (email: string) => (await bd.db.insert(schema.newsletterSubscribers).values({ email, confirmed: true, firstName: "Ana", lastName: email[0].toUpperCase() }).returning({ id: schema.newsletterSubscribers.id }))[0].id;
  const ana = await crear("ana@example.com");
  const beto = await crear("beto@example.com");
  const hace = (min: number) => new Date(Date.now() - min * 60_000);
  const rango = fil.leerFiltros({ desde: fil.hoyColombia(new Date(Date.now() - 2 * 86_400_000)), hasta: fil.hoyColombia() });

  // Sin autorización no se vincula nada.
  assert.equal(await sus.vincularVisitante(ana, V1, false), false);
  await sus.autorizarLectura(ana);
  assert.equal(await sus.vincularVisitante(ana, V1, false), true);
  const [antes] = await bd.db.select().from(schema.subscriberVisitors).where(eq(schema.subscriberVisitors.subscriberId, ana));
  assert.equal(antes.verified, false, "desde el formulario queda sin verificar");

  // Lecturas: una ANTERIOR al vínculo (no cuenta) y dos posteriores; otra persona sin autorizar no aparece.
  await bd.db.update(schema.subscriberVisitors).set({ linkedAt: hace(60) });
  await bd.db.insert(schema.readerSessions).values([
    { visitorId: V1, articleId: nota.id, createdAt: hace(120), maxScroll: 100, seconds: 300 },
    { visitorId: V1, articleId: nota.id, createdAt: hace(30), maxScroll: 90, seconds: 100, device: "mobile", source: "Directo" },
    { visitorId: V1, articleId: nota.id, createdAt: hace(10), maxScroll: 20, seconds: 20, device: "mobile", source: "Directo" },
    { visitorId: V2, articleId: nota.id, createdAt: hace(5), maxScroll: 80, seconds: 50 },
  ]);
  assert.equal(await sus.vincularVisitante(beto, V2, true), false, "Beto no autorizó: su lectura no se asocia");
  let filas = await ident.identificados(rango);
  assert.equal(filas.length, 1, "solo quien autorizó");
  assert.equal(filas[0].correo, "ana@example.com");
  assert.equal(filas[0].notas, 2, "la lectura anterior al vínculo no cuenta");
  assert.equal(filas[0].segundos, 120);
  assert.equal(filas[0].completas, 1);
  assert.equal(filas[0].verificado, false);
  assert.equal((await ident.lecturasDe(ana, rango)).length, 2);
  assert.deepEqual(await ident.lecturasDe(beto, rango), [], "quien no autorizó no tiene historial");

  // Verificar sube el vínculo; repetir sin verificar no lo baja.
  await sus.vincularVisitante(ana, V1, true);
  await sus.vincularVisitante(ana, V1, false);
  filas = await ident.identificados(rango);
  assert.equal(filas[0].verificado, true);
  assert.deepEqual(await ident.adopcion(), { autorizados: 1, vinculados: 1, suscritos: 2 });

  // La firma del enlace del correo es de ese suscriptor y no se puede falsificar ni cambiar de persona.
  process.env.AUTH_SECRET = "secreto-solo-para-las-pruebas-de-lectores";
  const firma = sus.lectorToken(ana);
  assert.equal(sus.lectorTokenValido(ana, firma), true);
  assert.equal(sus.lectorTokenValido(beto, firma), false);
  assert.equal(sus.lectorTokenValido(ana, firma.slice(0, -1) + (firma.endsWith("A") ? "B" : "A")), false);
  assert.equal(sus.lectorTokenValido(ana, ""), false);

  // Baja: desaparece del análisis y el mantenimiento borra el vínculo.
  await bd.db.update(schema.newsletterSubscribers).set({ unsubscribedAt: new Date() }).where(eq(schema.newsletterSubscribers.id, ana));
  assert.equal((await ident.identificados(rango)).length, 0);
  assert.equal(await sus.vincularVisitante(ana, V3, true), false, "tras la baja no se vincula nada");
  assert.equal(await sus.purgarVinculosDeBajas(), 1);
  assert.equal((await bd.db.select().from(schema.subscriberVisitors)).length, 0);
});

test("el detalle de lectura: un renglón por lector, con ciudad y filtros, y el nombre solo de quien autorizó y solo con permiso", async () => {
  const sus = await import("@/lib/lectores-suscriptor");
  const det = await import("@/lib/lectores-detalle");
  await bd.db.delete(schema.newsletterSubscribers);
  await bd.db.delete(schema.readerSessions);
  const [nota] = await bd.db.select({ id: schema.articles.id }).from(schema.articles).limit(1);
  const [{ id: lola }] = await bd.db.insert(schema.newsletterSubscribers).values({ email: "lola@example.com", confirmed: true, firstName: "Lola", lastName: "Pérez" }).returning({ id: schema.newsletterSubscribers.id });
  await sus.autorizarLectura(lola);
  await sus.vincularVisitante(lola, V1, true);
  const hace = (min: number) => new Date(Date.now() - min * 60_000);
  await bd.db.insert(schema.readerSessions).values([
    { visitorId: V1, articleId: nota.id, createdAt: hace(20), maxScroll: 95, seconds: 200, device: "mobile", city: "Bogotá", source: "Directo" },
    { visitorId: V1, articleId: nota.id, createdAt: hace(10), maxScroll: 40, seconds: 30, device: "mobile", city: "Bogotá", source: "Directo" },
    { visitorId: V2, articleId: nota.id, createdAt: hace(5), maxScroll: 70, seconds: 60, device: "desktop", city: "Medellín", source: "Google" },
  ]);
  const hoy = fil.hoyColombia();
  const todo = fil.leerFiltros({ desde: hoy, hasta: hoy });
  const con_ = await det.lectoresDetalle(todo, true);
  assert.equal(con_.total, 2);
  assert.equal(con_.filas[0].notas, 2, "el que más leyó va primero");
  assert.equal(con_.filas[0].nombre, "Lola Pérez");
  assert.equal(con_.filas[0].ciudad, "Bogotá");
  assert.equal(con_.filas[1].nombre, null, "el anónimo no tiene nombre");
  const sin = await det.lectoresDetalle(todo, false);
  assert.equal(sin.filas[0].nombre, null, "sin el permiso del boletín no se ve quién es");
  assert.equal(sin.filas[0].correo, null);
  // Filtrar por ciudad y por dispositivo recorta el registro.
  const bogota = await det.registroLecturas(fil.leerFiltros({ desde: hoy, hasta: hoy, ciudad: "Bogotá" }), true);
  assert.equal(bogota.length, 2);
  const pc = await det.registroLecturas(fil.leerFiltros({ desde: hoy, hasta: hoy, dispositivo: "desktop" }), true);
  assert.equal(pc.length, 1);
  assert.equal(pc[0].nombre, null);
  assert.equal((await det.registroLecturas(todo, true, V1)).length, 2, "el historial de un solo lector");
});
