/**
 * Datos de arranque para desarrollo. Idempotente (onConflictDoNothing).
 * Uso: npm run db:seed
 *
 * Crea un usuario administrador. Credenciales por defecto (cámbialas):
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema });

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "editor@contextoganadero.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "cambia-esta-clave";

  await db
    .insert(schema.users)
    .values({
      email,
      name: "Editor General",
      role: "administrador",
      passwordHash: await bcrypt.hash(password, 12),
    })
    .onConflictDoNothing();
  console.log(`usuario admin: ${email}`);

  const cats = [
    {
      slug: "economia-y-mercados",
      name: "Economía y mercados",
      description: "Precios, exportaciones e indicadores del sector.",
      legacyPaths: ["/economia", "/mercados"],
      sortOrder: 1,
    },
    {
      slug: "regiones",
      name: "Regiones",
      description: "Noticias de las zonas ganaderas del país.",
      legacyPaths: ["/regiones"],
      sortOrder: 2,
    },
    {
      slug: "sostenibilidad",
      name: "Sostenibilidad",
      description: "Ganadería sostenible, clima y ambiente.",
      legacyPaths: ["/ganaderia-sostenible"],
      sortOrder: 3,
    },
    {
      slug: "politica-gremial",
      name: "Política gremial",
      description: "Fedegán, gobierno y normativa.",
      legacyPaths: ["/politica"],
      sortOrder: 4,
    },
    {
      slug: "opinion",
      name: "Opinión",
      description: "Columnas y análisis.",
      legacyPaths: ["/columna", "/columnistas", "/blogs"],
      sortOrder: 5,
    },
  ];
  await db.insert(schema.categories).values(cats).onConflictDoNothing();

  await db
    .insert(schema.authors)
    .values({ slug: "redaccion", name: "Redacción CONtexto Ganadero", bio: "Equipo periodístico del medio." })
    .onConflictDoNothing();

  const [author] = await db
    .select()
    .from(schema.authors)
    .where(sql`${schema.authors.slug} = 'redaccion'`)
    .limit(1);
  const allCats = await db.select().from(schema.categories);
  const catBySlug = Object.fromEntries(allCats.map((c) => [c.slug, c.id]));

  const now = Date.now();
  const sample = [
    {
      slug: "precio-novillo-gordo-sube-en-medellin",
      title: "El precio del novillo gordo sube 4 % en Medellín durante septiembre",
      excerpt:
        "La central ganadera de Medellín reportó un alza sostenida en el precio del novillo gordo, impulsada por menor oferta regional.",
      categoryId: catBySlug["economia-y-mercados"],
      tags: ["precios", "novillo gordo", "Antioquia"],
    },
    {
      slug: "lluvias-mejoran-praderas-en-los-llanos",
      title: "Las lluvias de agosto mejoraron el estado de las praderas en los Llanos Orientales",
      excerpt:
        "Tras un primer semestre seco, la temporada de lluvias recuperó la capacidad de carga en fincas de Meta y Casanare.",
      categoryId: catBySlug["regiones"],
      tags: ["clima", "praderas", "Llanos"],
    },
    {
      slug: "sistemas-silvopastoriles-ganan-terreno",
      title: "Los sistemas silvopastoriles ganan terreno entre ganaderos del Caribe",
      excerpt:
        "Un programa de asistencia técnica acompañó la conversión de 1.200 hectáreas a sistemas silvopastoriles en Córdoba y Sucre.",
      categoryId: catBySlug["sostenibilidad"],
      tags: ["silvopastoril", "sostenibilidad", "Córdoba"],
    },
  ];

  for (let i = 0; i < sample.length; i++) {
    const s = sample[i];
    await db
      .insert(schema.articles)
      .values({
        ...s,
        body: `<p>${s.excerpt}</p><h2>Contexto</h2><p>Este es un artículo de ejemplo creado por el seed de desarrollo.</p>`,
        authorId: author?.id ?? null,
        status: "publicado",
        publishedAt: new Date(now - i * 86400000),
      })
      .onConflictDoNothing();
  }

  await db
    .insert(schema.redirects)
    .values([
      { fromPath: "/economia/precio-del-ganado-hoy", toPath: "/categoria/economia-y-mercados" },
      { fromPath: "/nota/12345", toPath: "/articulo/precio-novillo-gordo-sube-en-medellin" },
    ])
    .onConflictDoNothing();

  await db
    .insert(schema.adsZones)
    .values([
      { key: "home_top", name: "Home — banner superior" },
      { key: "article_sidebar", name: "Artículo — barra lateral" },
    ])
    .onConflictDoNothing();

  await db
    .insert(schema.dataSeries)
    .values({
      key: "precio_novillo_gordo_medellin",
      name: "Precio novillo gordo — Medellín",
      unit: "COP/kg",
      source: "Central Ganadera de Medellín",
    })
    .onConflictDoNothing();

  console.log("seed completo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
