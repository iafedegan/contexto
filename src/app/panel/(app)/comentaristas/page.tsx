// Comentaristas: todas las firmas del sitio (autores y columnistas, con o sin cuenta en la plataforma) para editarlas, inactivarlas o borrarlas.
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { ComentaristasLista, type FilaComentarista } from "@/components/panel/comentaristas-lista";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comentaristas" };

export default async function Comentaristas() {
  await requireRole("administrador");
  const filas = await db
    .select({ id: authors.id, nombre: authors.name, bio: authors.bio, activo: authors.active, cuenta: users.email, cuentaActiva: users.active, notas: sql<number>`(select count(*)::int from ${articles} where ${articles.authorId} = ${authors.id})` })
    .from(authors)
    .leftJoin(users, eq(authors.userId, users.id))
    .orderBy(asc(authors.name));
  const datos: FilaComentarista[] = filas.map((f) => ({ id: f.id, nombre: f.nombre, bio: f.bio ?? "", notas: f.notas, cuenta: f.cuenta, cuentaActiva: f.cuentaActiva, activo: f.activo }));
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header>
        <p className="lx-kicker text-[var(--accent)]">Configuración</p>
        <h1 className="lx-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Comentaristas</h1>
        <p className="mt-2 max-w-2xl text-[var(--fg-muted)]">
          Las firmas que se pueden elegir como autor de una nota: comentaristas y columnistas, y las personas registradas en la plataforma. Al elegir el autor solo salen las activas
          (y, de las registradas, las que tienen la cuenta activa). Una firma que ya firma notas no se borra: se inactiva.
        </p>
      </header>
      <ComentaristasLista filas={datos} />
    </div>
  );
}
