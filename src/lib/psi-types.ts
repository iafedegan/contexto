/**
 * Tipos del informe de PageSpeed Insights. Fichero aparte y SIN `server-only`
 * porque los consume el editor (componente de cliente); el cliente de la API
 * vive en `psi.ts` y nunca llega al navegador.
 */

export type PsiAudit = {
  id: string;
  title: string;
  description: string;
  /** 0–1, o null si es informativa. */
  score: number | null;
};

export type PsiReport = {
  url: string;
  strategy: "mobile" | "desktop";
  /** 0–100 por categoría; null si Google no la devolvió. */
  scores: { seo: number | null; performance: number | null; accessibility: number | null; bestPractices: number | null };
  /** Auditorías SEO que NO pasan: lo accionable antes de publicar. */
  failed: PsiAudit[];
  /** Auditorías SEO superadas, para dar contexto del total. */
  passedCount: number;
  fetchedAt: string;
};

export type PsiResult = { ok: true; report: PsiReport } | { ok: false; error: string };
