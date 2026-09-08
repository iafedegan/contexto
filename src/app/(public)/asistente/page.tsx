import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant-chat";

export const metadata: Metadata = {
  title: "Asistente",
  description:
    "Asistente conversacional de CONtexto Ganadero: responde con base en el archivo completo del medio y cita cada fuente.",
};

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-extrabold">Asistente CONtexto Ganadero</h1>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        Recuperación sobre contenido propio + archivo histórico. No sustituye la asesoría de un
        médico veterinario para casos individuales.
      </p>
      <div className="mt-6">
        <AssistantChat />
      </div>
    </div>
  );
}
