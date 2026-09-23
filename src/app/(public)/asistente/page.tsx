import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant-chat";

export const metadata: Metadata = {
  title: "Asistente",
  description:
    "Asistente conversacional de CONtexto Ganadero: responde con base en el archivo completo del medio y cita cada fuente.",
};

export default function AssistantPage() {
  return (
    <div className="rise mx-auto max-w-2xl">
      <p className="kicker">Asistente</p>
      <h1 className="mt-1.5 text-[2rem] font-extrabold tracking-[-0.025em]">
        Pregúntale al archivo de CONtexto Ganadero
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-soft)]">
        Recuperación sobre el contenido propio y el archivo histórico completo. Cada respuesta cita
        sus fuentes con enlace verificable. No sustituye la asesoría de un médico veterinario para
        casos individuales.
      </p>
      <div className="mt-8">
        <AssistantChat />
      </div>
    </div>
  );
}
