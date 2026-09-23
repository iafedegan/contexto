import "server-only";
import { getPsiKey, readAnalytics } from "@/lib/analytics-server";
import { getSiteIdentity } from "@/lib/site-identity";

/**
 * PageSpeed Insights: Lighthouse ejecutado por Google sobre una URL real.
 *
 * Es la auditoría "seria" que pedía la redacción — no una heurística nuestra —
 * pero tiene una condición ineludible: Google tiene que poder ABRIR la página.
 * Con el sitio en `localhost` no hay forma; hace falta el dominio publicado o
 * un túnel declarado en Configuración.
 */

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export type { PsiAudit, PsiReport, PsiResult } from "@/lib/psi-types";
import type { PsiAudit, PsiResult } from "@/lib/psi-types";


/**
 * Base pública del sitio: primero el túnel declarado en el panel, luego el
 * dominio canónico, y por último la variable de entorno.
 */
export async function publicBase(): Promise<string | null> {
  const { publicBaseUrl } = await readAnalytics();
  if (publicBaseUrl) return publicBaseUrl.replace(/\/$/, "");

  const { domain } = await getSiteIdentity();
  if (domain) return `https://${domain.replace(/\/$/, "")}`;

  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && !/localhost|127\.0\.0\.1/.test(env)) return env.replace(/\/$/, "");

  return null;
}

export async function runPageSpeed(
  url: string,
  strategy: "mobile" | "desktop" = "mobile",
): Promise<PsiResult> {
  const { key } = await getPsiKey();
  if (!key) {
    return {
      ok: false,
      error:
        "Falta la clave de PageSpeed Insights. Añádela en Configuración › Analítica y SEO (es gratuita, se saca en Google Cloud).",
    };
  }
  if (/localhost|127\.0\.0\.1/.test(url)) {
    return {
      ok: false,
      error:
        "Google no puede abrir una dirección local. Publica el sitio o declara una base pública (por ejemplo un túnel ngrok) en Configuración › Analítica y SEO.",
    };
  }

  const params = new URLSearchParams({ url, strategy, key });
  for (const c of ["seo", "performance", "accessibility", "best-practices"]) {
    params.append("category", c);
  }

  let data: PsiRaw;
  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { cache: "no-store" });
    data = (await res.json()) as PsiRaw;
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error?.message
          ? `Google respondió: ${data.error.message.slice(0, 240)}`
          : `Google respondió ${res.status}.`,
      };
    }
  } catch {
    return { ok: false, error: "No se pudo contactar con PageSpeed Insights." };
  }

  const lh = data.lighthouseResult;
  if (!lh) return { ok: false, error: "Google no devolvió informe para esa dirección." };

  const cat = lh.categories ?? {};
  const pct = (v?: { score?: number | null }) =>
    typeof v?.score === "number" ? Math.round(v.score * 100) : null;

  const seoRefs = cat.seo?.auditRefs ?? [];
  const failed: PsiAudit[] = [];
  let passedCount = 0;
  for (const ref of seoRefs) {
    const a = lh.audits?.[ref.id];
    if (!a || a.scoreDisplayMode === "notApplicable" || a.scoreDisplayMode === "manual") continue;
    if (typeof a.score === "number" && a.score < 0.9) {
      failed.push({ id: ref.id, title: a.title ?? ref.id, description: a.description ?? "", score: a.score });
    } else if (typeof a.score === "number") {
      passedCount += 1;
    }
  }

  return {
    ok: true,
    report: {
      url,
      strategy,
      scores: {
        seo: pct(cat.seo),
        performance: pct(cat.performance),
        accessibility: pct(cat.accessibility),
        bestPractices: pct(cat["best-practices"]),
      },
      failed,
      passedCount,
      fetchedAt: new Date().toISOString(),
    },
  };
}

/** Forma mínima de la respuesta de la API que realmente consumimos. */
type PsiRaw = {
  error?: { message?: string };
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null; auditRefs?: { id: string }[] }>;
    audits?: Record<
      string,
      { title?: string; description?: string; score?: number | null; scoreDisplayMode?: string }
    >;
  };
};
