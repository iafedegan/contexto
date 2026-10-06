import { resumirAvisoCsp } from "@/lib/csp";
import { clientIp, hit } from "@/lib/rate-limit";

/**
 * Recibe los avisos de la CSP (src/lib/csp.ts) y los deja en los logs del servidor (Vercel → Logs) para saber qué
 * recurso legítimo está bloqueando la política. No guarda nada del visitante.
 *
 * Es público (el navegador no envía credenciales), así que se acota (H-19): como mucho 20 avisos por IP y hora, 200 por
 * hora en total, y de cada uno solo se registran los campos útiles y cortados, no el cuerpo entero. Un ataque de
 * relleno no llena los logs ni cuesta dinero; un fallo real sigue siendo visible porque se repite en muchas IP.
 */
export async function POST(req: Request) {
  try {
    const [porIp, global] = await Promise.all([hit(`csp:${clientIp(req.headers)}`, 20, 3600), hit("csp:global", 200, 3600)]);
    if (porIp.allowed && global.allowed) {
      const cuerpo = (await req.text()).slice(0, 4000);
      console.warn("[csp]", resumirAvisoCsp(cuerpo));
    }
  } catch {
    /* aviso ilegible: se ignora */
  }
  return new Response(null, { status: 204 });
}
