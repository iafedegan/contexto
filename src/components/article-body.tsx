import { InteractiveChart } from "@/components/interactive-chart";
import { decodeSpec } from "@/lib/chart-svg";

const CHART_FIGURE = /<figure\b[^>]*\bdata-chart="([\w-]+)"[^>]*>([\s\S]*?)<\/figure>/g;

/**
 * Las tablas de las notas (precios por categoría, resultados de subastas…) son
 * más anchas que un teléfono. Cada una se envuelve en una caja que se desplaza
 * en horizontal (`.lx-table-wrap`, con tabindex para poder moverla con el
 * teclado) en vez de ensanchar la página. El HTML ya viene sanitizado: esto
 * solo añade marcado propio.
 */
function envolverTablas(html: string): string {
  return html
    .replace(/<table\b/gi, '<div class="lx-table-wrap" role="region" aria-label="Tabla" tabindex="0"><table')
    .replace(/<\/table>/gi, "</table></div>");
}

/**
 * Cuerpo de un artículo (HTML ya sanitizado). Las gráficas que inserta el
 * asistente llegan como <figure data-chart="…"> con una imagen estática de
 * respaldo; aquí se sustituyen por la gráfica interactiva. Si los datos no
 * son válidos se deja la imagen estática tal cual.
 */
export function ArticleBody({ html: crudo, className }: { html: string; className?: string }) {
  const html = envolverTablas(crudo);
  const parts: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of html.matchAll(CHART_FIGURE)) {
    const spec = decodeSpec(m[1]);
    if (!spec) continue;
    if (m.index! > last) parts.push(<div key={k++} className="contents" dangerouslySetInnerHTML={{ __html: html.slice(last, m.index) }} />);
    const caption = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/.exec(m[2])?.[1];
    parts.push(<InteractiveChart key={k++} spec={spec} caption={caption} />);
    last = m.index! + m[0].length;
  }
  if (!parts.length) return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  if (last < html.length) parts.push(<div key={k++} className="contents" dangerouslySetInnerHTML={{ __html: html.slice(last) }} />);
  return <div className={className}>{parts}</div>;
}
