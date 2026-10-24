import { Radio } from "lucide-react";
import { requirePermiso } from "@/lib/auth";
import { getEnVivo } from "@/lib/en-vivo";
import { EnVivoForm } from "@/components/panel/en-vivo-form";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";

// Pantalla para encender la transmisión en vivo de la portada (exige el permiso «avisos»).
export default async function EnVivoPage() {
  await requirePermiso("avisos");
  const inicial = await getEnVivo();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="lx-kicker text-[var(--accent)]">Panel editorial</p>
        <h1 className="lx-display mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <Radio size={24} className="text-[var(--accent)]" /> En vivo
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--fg-muted)]">
          Mientras la transmisión esté activa, el video de YouTube ocupa el lugar principal de la portada y la nota destacada baja a
          «Lo último». Al apagarla, la portada vuelve a como estaba.
        </p>
      </header>

      <EnVivoForm inicial={inicial} />
    </div>
  );
}
