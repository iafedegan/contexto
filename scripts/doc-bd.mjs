#!/usr/bin/env node
/** Genera docs/base-de-datos.md a partir de src/db/schema.ts (tablas, columnas, claves y módulo dueño). `npm run docs:bd` */
import fs from "node:fs";
const src = fs.readFileSync(new URL("../src/db/schema.ts", import.meta.url), "utf8");
const dueño = { users: "acceso", passkeys: "acceso", sessions: "acceso", verification_tokens: "acceso", authors: "contenido", categories: "contenido", articles: "contenido", redirects: "contenido", article_views_daily: "analitica", rate_limits: "infra", archive_index: "archivo", ads_zones: "portada-tema", newsletter_subscribers: "newsletter", newsletter_editions: "newsletter", data_series: "analitica", data_points: "analitica", agent_drafts: "ia", assistant_queries: "ia", api_clients: "acceso", site_settings: "portada-tema / configuración", contact_messages: "contenido (contacto)", push_subscriptions: "canales" };
const out = ["# Base de datos", "", "Generado desde `src/db/schema.ts` con `npm run docs:bd`. PostgreSQL (Supabase) + `pgvector`; en local, PGlite. Migraciones: `npm run db:generate` → revisar el SQL → `npm run db:migrate`; índices vectoriales y de texto completo en `drizzle/manual/99_post_indexes.sql`.", ""];
const re = /export const (\w+) = pgTable\(\s*["']([\w_]+)["']\s*,\s*\{([\s\S]*?)\n\s*\}(?:,|\))/g;
let m, n = 0;
const tablas = [];
while ((m = re.exec(src))) {
  const cols = [...m[3].matchAll(/^\s{2,4}(\w+):\s*([^\n]+)$/gm)].map((c) => {
    const def = c[2].replace(/,\s*$/, "");
    const tipo = (def.match(/^(\w+)\(/) ?? [])[1] ?? "";
    const nombre = (def.match(/\(\s*["']([\w_]+)["']/) ?? [])[1] ?? c[1];
    const marcas = [def.includes("primaryKey") && "PK", def.includes("notNull") && "obligatorio", def.includes(".unique") && "único", /references\(\(\) => (\w+)\.(\w+)/.exec(def) && `→ ${/references\(\(\) => (\w+)\.(\w+)/.exec(def).slice(1).join(".")}`].filter(Boolean);
    return { nombre, tipo, marcas };
  });
  tablas.push({ ts: m[1], tabla: m[2], cols });
}
for (const t of tablas) {
  n++;
  out.push(`## \`${t.tabla}\``, "", `Módulo dueño: **${dueño[t.tabla] ?? "—"}** · variable en el esquema: \`${t.ts}\``, "", "| Columna | Tipo | Notas |", "|---|---|---|");
  for (const c of t.cols) out.push(`| \`${c.nombre}\` | ${c.tipo} | ${c.marcas.join(", ")} |`);
  out.push("");
}
fs.writeFileSync(new URL("../docs/base-de-datos.md", import.meta.url), out.join("\n"));
console.log(`docs/base-de-datos.md: ${n} tablas`);
