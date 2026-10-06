import type { Locale } from "@/lib/i18n";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";

/** Reglas de gobernanza de la IA editorial: las que la propuesta (§6.3) se compromete a cumplir y publicar. */
const REGLAS: { titulo: string; texto: string }[] = [
  { titulo: "Aprobación humana obligatoria", texto: "Ningún contenido generado con IA se publica solo. El estado «publicado» es inaccesible para los agentes: únicamente una persona con el rol de editor puede aprobar y publicar." },
  { titulo: "Firma humana", texto: "La nota publicada se atribuye al editor que la aprueba, nunca al sistema." },
  { titulo: "Verificación de cifras y citas", texto: "Un verificador contrasta cada cifra y cada cita textual contra la fuente. Lo que no se puede comprobar se corrige, se marca para revisión o se omite; no se inventan datos ni declaraciones." },
  { titulo: "Trazabilidad", texto: "De cada borrador se registra la fuente, la versión del modelo, el editor que lo revisó y la fecha y hora de la decisión." },
  { titulo: "Límite de volumen", texto: "Existe un tope diario de borradores para evitar producción masiva sin valor editorial." },
  { titulo: "Asistente de consultas", texto: "Responde solo con artículos del archivo del medio y cita cada fuente con enlace verificable; si no encuentra fuentes, no responde. No da asesoría veterinaria ni sanitaria sobre casos individuales." },
];

// Página de la política de uso de inteligencia artificial.
async function PoliticaIA({ locale }: { locale: Locale }) {
  const site = await getSiteTheme();
  return (
    <SiteShell theme={site.theme} style={site.style} locale={locale} variant="institucional">
      <article>
        <header className="text-center">
          <p className="lx-kicker text-[var(--accent-2)]">{locale === "es" ? "Transparencia" : "Transparency"}</p>
          <h1 className="lx-display mt-4 text-4xl leading-tight tracking-wide md:text-5xl">
            {locale === "es" ? "Política de uso de inteligencia artificial" : "Artificial intelligence use policy"}
          </h1>
          <div className="mx-auto mt-6 flex max-w-xs items-center gap-3">
            <span className="h-px flex-1 bg-[var(--accent)]" />
            <span className="size-1.5 rotate-45 bg-[var(--accent-2)]" />
            <span className="h-px flex-1 bg-[var(--accent)]" />
          </div>
        </header>
        <div className="prose prose-drop mt-12">
          <p>
            CONtexto Ganadero usa inteligencia artificial para ampliar la cobertura del equipo de redacción, no para reemplazarlo.
            Estas son las reglas que cumplimos y que cualquier lector puede exigirnos.
          </p>
          {REGLAS.map((r) => (
            <section key={r.titulo}>
              <h2>{r.titulo}</h2>
              <p>{r.texto}</p>
            </section>
          ))}
          <p>
            Esta política complementa nuestra <a href="/politica-editorial">política editorial</a>. Si ves un error o una cifra dudosa en una nota,
            escríbenos desde la página de <a href="/contacto">contacto</a>.
          </p>
        </div>
      </article>
    </SiteShell>
  );
}

/** Fábrica: la misma página en cualquier idioma de interfaz. */
export function makePage(locale: Locale) {
  return function Page() {
    return PoliticaIA({ locale });
  };
}
