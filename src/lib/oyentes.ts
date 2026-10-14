import "server-only";
import { after } from "next/server";
import { alOcurrir } from "@/lib/eventos";
import { procesarBoletinesProgramados } from "@/lib/newsletter/envio";
import { avisarSiUltimaHora } from "@/lib/push";

/**
 * Cableado de los eventos de dominio: aquí (y solo aquí) se decide quién reacciona a qué. Lo carga
 * `src/instrumentation.ts` una vez al arrancar el servidor. Es la única pieza que conoce a la vez al módulo que
 * emite y al que reacciona.
 */

// Una nota de «Última hora» recién publicada se avisa a los lectores por push (una vez).
alOcurrir("nota.publicada", ({ ids }) => avisarSiUltimaHora(ids));

// El aviso de un navegador (que llega aunque el cron de Vercel sea diario) envía, DESPUÉS de responder, el boletín programado cuya hora ya llegó.
// Sin nada pendiente no hace nada, y la pasada se limita a una cada ~50 s en todo el sitio.
alOcurrir("programadas.aviso", () => {
  after(() => procesarBoletinesProgramados({ tiempoMs: 45_000 }).catch((e) => console.error("programadas.aviso: falló el envío de boletines", e)));
});
