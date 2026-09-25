/**
 * Recibe los avisos de la CSP en modo solo informe (next.config.ts) y los deja
 * en los logs del servidor (Vercel → Logs), para decidir qué permitir antes de
 * hacerla obligatoria. No guarda nada del visitante.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.text()).slice(0, 4000);
    console.warn("[csp]", body);
  } catch {
    /* aviso ilegible: se ignora */
  }
  return new Response(null, { status: 204 });
}
