/**
 * El logo de CONtexto Ganadero Media recreado en SVG (a partir del oficial «Variaciones logo CONtexto 2026», de Illustrator), para dominarlo
 * desde el código: escala sin perder nitidez y sus colores salen de variables CSS, así que se ajustan por modo (claro/oscuro), desde el editor
 * de la cabecera (pieza «Nombre del sitio», ver `section-els.ts`) o a mano:
 *   --logo-oscuro  (sombra de la lámina dorada)   por defecto #8a6624
 *   --logo-medio   (tono base; también «14 AÑOS» y los filetes)  #c9a24a
 *   --logo-claro   (brillo)                        #f6e9b4
 * Un color plano: las tres iguales. La C con el play es geometría (anillo abierto a la derecha y triángulo); los textos van en las letras
 * del original, cargadas en src/app/fonts.ts: CONTEXTO y «14 AÑOS» en Montserrat (`--f-montserrat`), GANADERO MEDIA en Nunito (`--f-nunito`),
 * con `textLength` para que ocupen exactamente el ancho del original.
 *
 * `id` debe ser distinto en cada logo de la misma página (el degradado se referencia por id y uno oculto con display:none no pinta).
 */

type Props = { id: string; titulo?: string; className?: string; variante?: "horizontal" | "emblema"; conAnios?: boolean };

// El emblema en su propio sistema de medidas (372 × 368): anillo de radio 184 y grosor 62, abierto 42° arriba y abajo a la derecha.
const CX = 186, CY = 184, R = 184, r = 122, ABRE = (42 * Math.PI) / 180;
const pt = (rad: number, ang: number) => `${(CX + rad * Math.cos(ang)).toFixed(2)} ${(CY + rad * Math.sin(ang)).toFixed(2)}`;
const ANILLO = `M${pt(R, -ABRE)} A${R} ${R} 0 1 0 ${pt(R, ABRE)} L${pt(r, ABRE)} A${r} ${r} 0 1 1 ${pt(r, -ABRE)} Z`;
const PLAY = "M135 108 L276 184 L135 262 Z";
// Filete fino interior (el biselado del original), un poco más adentro del borde del anillo.
const BISEL = `M${pt(R - 14, -ABRE + 0.06)} A${R - 14} ${R - 14} 0 1 0 ${pt(R - 14, ABRE - 0.06)}`;

function Degradado({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: "var(--logo-oscuro, #8a6624)" }} />
        <stop offset="0.28" style={{ stopColor: "var(--logo-claro, #f6e9b4)" }} />
        <stop offset="0.5" style={{ stopColor: "var(--logo-medio, #c9a24a)" }} />
        <stop offset="0.7" style={{ stopColor: "var(--logo-claro, #f6e9b4)" }} />
        <stop offset="1" style={{ stopColor: "var(--logo-oscuro, #8a6624)" }} />
      </linearGradient>
    </defs>
  );
}

function Emblema({ fill, transform }: { fill: string; transform?: string }) {
  return (
    <g transform={transform}>
      <path d={ANILLO} fill={fill} />
      <path d={BISEL} fill="none" stroke="var(--logo-claro, #f6e9b4)" strokeOpacity="0.55" strokeWidth="5" />
      <path d={PLAY} fill={fill} />
    </g>
  );
}

export function LogoContexto({ id, titulo = "CONtexto Ganadero Media", className, variante = "horizontal", conAnios = true }: Props) {
  const g = `logo-oro-${id}`;
  const fill = `url(#${g})`;
  if (variante === "emblema")
    return (
      <svg viewBox="0 0 372 368" role="img" aria-label={titulo} className={className} data-color-de="h-nombre">
        <Degradado id={g} />
        <Emblema fill={fill} />
      </svg>
    );
  // Medidas tomadas del logo horizontal original (lienzo de 1080 de ancho): emblema de 210 de alto, «ONTEXTO» de 700 de ancho a su lado,
  // «GANADERO MEDIA» debajo y, con `conAnios`, «— 14 AÑOS —» entre filetes.
  const alto = conAnios ? 320 : 262;
  return (
    <svg viewBox={`80 50 910 ${alto}`} role="img" aria-label={titulo} className={className} data-color-de="h-nombre">
      <title>{titulo}</title>
      <Degradado id={g} />
      <Emblema fill={fill} transform="translate(85 55) scale(0.5707)" />
      <g fill={fill}>
        <text x="285" y="215" fontSize="138" fontWeight="900" textLength="700" lengthAdjust="spacingAndGlyphs" style={{ fontFamily: "var(--f-montserrat), Montserrat, 'Arial Black', system-ui, sans-serif" }}>ONTEXTO</text>
        <text x="290" y="298" fontSize="86" fontWeight="400" textLength="675" lengthAdjust="spacingAndGlyphs" style={{ fontFamily: "var(--f-nunito), Nunito, system-ui, sans-serif" }}>GANADERO MEDIA</text>
      </g>
      {conAnios && (
        <g>
          <path d="M88 346 H412 M678 346 H980" stroke="var(--logo-medio, #c9a24a)" strokeWidth="3" />
          <text x="545" y="361" textAnchor="middle" fontSize="46" fontWeight="700" letterSpacing="11" fill="var(--logo-medio, #c9a24a)" style={{ fontFamily: "var(--f-montserrat), Montserrat, system-ui, sans-serif" }}>
            14 AÑOS
          </text>
        </g>
      )}
    </svg>
  );
}
