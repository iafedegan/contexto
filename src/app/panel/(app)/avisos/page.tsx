import { BellRing } from "lucide-react";
import { requirePermiso } from "@/lib/auth";
import { contarSuscriptores, pushConfigurado } from "@/lib/push";
import { AvisoForm } from "@/components/panel/aviso-form";
import { notasRecientes } from "./actions";

export const dynamic = "force-dynamic";

export default async function AvisosPage() {
  await requirePermiso("avisos");
  const [notas, suscriptores] = await Promise.all([
    notasRecientes(),
    contarSuscriptores().catch(() => 0),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="lx-kicker text-[var(--accent)]">Panel editorial</p>
        <h1 className="lx-display mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <BellRing size={24} className="text-[var(--accent)]" /> Avisos de última hora
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--fg-muted)]">
          Una notificación push llega al teléfono del lector y no se puede retirar. Úsala solo cuando
          la noticia lo justifique: el abuso es la vía más rápida a que la desactiven.
        </p>
      </header>

      <AvisoForm notas={notas} suscriptores={suscriptores} configurado={pushConfigurado()} />
    </div>
  );
}
