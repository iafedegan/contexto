import { t, type Locale } from "@/lib/i18n";
import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";

/** Documento institucional — plantilla «Mármol & Verde Botella». */
export const metadata: Metadata = {
  title: "Política editorial",
  description:
    "Cómo trabaja la redacción de CONtexto Ganadero: verificación, uso de asistentes de IA y atribución de autoría.",
};

// Secciones del índice de la política editorial.
const SECCIONES = [
  { id: "ia", label: "Uso de asistentes de IA" },
  { id: "asistente", label: "Asistente de consultas" },
  { id: "archivo", label: "Archivo histórico" },
];

// Página de la política editorial y de uso de IA.
async function PoliticaEditorial({ locale }: { locale: Locale }) {
  const site = await getSiteTheme();
  return (
    <SiteShell theme={site.theme} style={site.style} locale={locale} variant="institucional">
      <article>
        <header className="text-center">
          <p className="lx-kicker text-[var(--accent-2)]">{t(locale, "policy.kicker")}</p>
          <h1 className="lx-display mt-4 text-4xl leading-tight tracking-wide md:text-5xl">
            {t(locale, "policy.title")}
          </h1>
          <div className="mx-auto mt-6 flex max-w-xs items-center gap-3">
            <span className="h-px flex-1 bg-[var(--accent)]" />
            <span className="size-1.5 rotate-45 bg-[var(--accent-2)]" />
            <span className="h-px flex-1 bg-[var(--accent)]" />
          </div>
        </header>

        <nav
          aria-label="Contenido del documento"
          className="lx-card mt-10 p-6"
        >
          <p className="lx-kicker text-[var(--accent)]">{t(locale, "policy.contents")}</p>
          <ol className="lx-ui mt-4 flex flex-col gap-2 text-sm">
            {SECCIONES.map((s, i) => (
              <li key={s.id} className="flex gap-3">
                <span className="text-[var(--accent-2)]">{String(i + 1).padStart(2, "0")}</span>
                <a href={`#${s.id}`} className="lx-link">
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="prose prose-drop mt-12">
          <p>
            CONtexto Ganadero es un medio periodístico del sector ganadero y agropecuario
            colombiano. Esta página resume nuestras prácticas de verificación y el papel de las
            herramientas de inteligencia artificial en la producción de contenido.
          </p>
          <h2 id="ia">Uso de asistentes de IA</h2>
          <p>
            Empleamos agentes de IA para redactar borradores a partir de fuentes estructuradas
            (boletines de precios, comunicados, convocatorias, agendas de ferias). Todo borrador
            pasa por un agente verificador que contrasta cada cifra contra su fuente y por la
            aprobación de un editor humano antes de publicarse. Ningún texto se publica de forma
            automática y el contenido publicado se atribuye siempre a un editor, no al sistema.
          </p>
          <h2 id="asistente">Asistente de consultas</h2>
          <p>
            Nuestro asistente conversacional responde únicamente con base en el archivo del medio y
            cita sus fuentes con enlace verificable. No ofrece asesoría veterinaria ni sanitaria
            para casos individuales.
          </p>
          <h2 id="archivo">Archivo histórico</h2>
          <p>
            Los artículos publicados antes de esta plataforma permanecen disponibles en sus
            direcciones originales, sin cambios.
          </p>
        </div>

        <p className="lx-ui mt-14 border-t border-[var(--border)] pt-5 text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">
          {t(locale, "policy.approved")}
        </p>
      </article>
    </SiteShell>
  );
}


/** Fábrica: la misma página en cualquier idioma de interfaz. */
export function makePage(locale: Locale) {
  return function Page(props: Parameters<typeof PoliticaEditorial>[0]) {
    return PoliticaEditorial({ ...props, locale } as never);
  };
}
