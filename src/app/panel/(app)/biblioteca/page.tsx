import { requirePermiso } from "@/lib/auth";
import { BibliotecaExplorador } from "@/components/panel/biblioteca-explorador";

export const dynamic = "force-dynamic";
export const metadata = { title: "Biblioteca de imágenes" };

// Carpetas e imágenes de las notas: la diseñadora las deja listas y asigna cada carpeta a quien las va a usar.
export default async function Biblioteca() {
  await requirePermiso("biblioteca");
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold">Biblioteca de imágenes</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--fg-muted)]">
          Crea carpetas, sube las imágenes de las notas y asigna cada carpeta a una o varias personas. Ellas la encuentran en el paso «Imagen de portada» al escribir una nota.
          Lo que está aquí no se borra solo aunque ninguna nota lo use.
        </p>
      </header>
      <BibliotecaExplorador modo="gestion" />
    </div>
  );
}
