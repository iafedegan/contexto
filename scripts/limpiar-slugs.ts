/**
 * Quita de las direcciones de las notas el sufijo al azar que se les agregaba cuando el título ya existía (`…-mwp9bxru`, la fecha en base 36) y
 * lo deja en la dirección limpia (o, si ya está tomada, con un número corto: `…-2`). Deja una redirección 301 de la dirección vieja a la nueva,
 * así los enlaces ya compartidos o indexados siguen funcionando.
 *
 * Por defecto solo SIMULA (lista qué cambiaría); con `--aplicar` escribe. Necesita DATABASE_URL. Se puede repetir sin riesgo.
 * Uso: npx tsx scripts/limpiar-slugs.ts            (simulacro)
 *      npx tsx scripts/limpiar-slugs.ts --aplicar
 * Después de aplicar, las páginas ya generadas se actualizan con el próximo despliegue o al republicar cada nota.
 */
import "dotenv/config";
import postgres from "postgres";
import { SUFIJO_ANTIGUO } from "../src/lib/slug-libre";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}
const aplicar = process.argv.includes("--aplicar");
const sql = postgres(url, { max: 1 });

type Nota = { id: string; slug: string; legacy_path: string | null; categoria: string | null };
const SECCIONES_COLUMNA = ["columnas", "columna", "opinion", "columnistas"];

/** Dirección pública de una nota, igual que `rutaDeNota` (src/lib/ruta-nota.ts). */
const ruta = (n: { slug: string; legacy_path: string | null; categoria: string | null }) =>
  n.legacy_path ?? (n.categoria && SECCIONES_COLUMNA.includes(n.categoria) ? `/columna/${n.slug}` : `/articulo/${n.slug}`);

async function main() {
  const notas = await sql<Nota[]>`
    select a.id, a.slug, a.legacy_path, c.slug as categoria
    from articles a left join categories c on c.id = a.category_id
    where a.slug ~ '-[l-n][0-9a-z]{7}$'
    order by a.created_at`;
  console.log(`${notas.length} notas con sufijo al azar en su dirección${aplicar ? "" : " (simulacro: no se escribe nada)"}.`);
  let hechas = 0;
  for (const n of notas) {
    if (!SUFIJO_ANTIGUO.test(n.slug)) continue;
    const base = n.slug.replace(SUFIJO_ANTIGUO, "");
    if (!base) continue;
    // Primera dirección libre: la limpia, y si no, con -2, -3…
    let nueva = base;
    for (let k = 2; ; k++) {
      const [choque] = await sql`select 1 from articles where slug = ${nueva} and id <> ${n.id} limit 1`;
      const [choquePath] = await sql`select 1 from articles where legacy_path = ${n.legacy_path ? n.legacy_path.replace(n.slug, nueva) : "/_"} and id <> ${n.id} limit 1`;
      if (!choque && !choquePath) break;
      nueva = `${base.slice(0, 96 - String(k).length - 1).replace(/-$/, "")}-${k}`;
    }
    const antigua = ruta(n);
    const nuevoLegacy = n.legacy_path && n.legacy_path.endsWith(n.slug) ? n.legacy_path.slice(0, -n.slug.length) + nueva : n.legacy_path;
    const destino = ruta({ slug: nueva, legacy_path: nuevoLegacy, categoria: n.categoria });
    console.log(`${antigua}  →  ${destino}`);
    if (!aplicar) continue;
    await sql.begin(async (tx) => {
      await tx`update articles set slug = ${nueva}, legacy_path = ${nuevoLegacy}, updated_at = now() where id = ${n.id}`;
      // La dirección vieja (y la de /articulo, por si se enlazó así) redirigen a la nueva.
      for (const desde of new Set([antigua, `/articulo/${n.slug}`])) {
        if (desde === destino) continue;
        await tx`insert into redirects (from_path, to_path, status_code) values (${desde}, ${destino}, 301)
                 on conflict (from_path) do update set to_path = excluded.to_path, status_code = 301`;
      }
    });
    hechas++;
  }
  console.log(aplicar ? `Listo: ${hechas} direcciones limpiadas, con su redirección 301.` : "Simulacro terminado. Repite con --aplicar para escribir.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
