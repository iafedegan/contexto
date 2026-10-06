import "server-only";
import { alOcurrir } from "@/lib/eventos";
import { avisarSiUltimaHora } from "@/lib/push";

/**
 * Cableado de los eventos de dominio: aquí (y solo aquí) se decide quién reacciona a qué. Lo carga
 * `src/instrumentation.ts` una vez al arrancar el servidor. Es la única pieza que conoce a la vez al módulo que
 * emite y al que reacciona.
 */

// Una nota de «Última hora» recién publicada se avisa a los lectores por push (una vez).
alOcurrir("nota.publicada", ({ ids }) => avisarSiUltimaHora(ids));
