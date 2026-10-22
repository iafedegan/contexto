/**
 * Personaje «ganadero»: caricatura de cuerpo completo de un ganadero colombiano (sombrero aguadeño, camisa remangada, carriel, pantalón
 * caqui, botas y un lazo al cinto), en SVG + CSS (sin imágenes). Las partes que se mueven llevan clase (`gn-…`): el pecho respira, parpadea,
 * las pupilas siguen el cursor (`--mx`/`--my`, que pone el avatar) y cada gesto (`data-gesto`) activa una animación: saludo, sombrero, lazo
 * e idea. Con `prefers-reduced-motion` queda quieto (ver globals.css).
 *
 * Es un personaje ilustrado del asistente virtual, no una persona real que hable: lo que responde es siempre el asistente con IA.
 */
const T = "#3b2a1a"; // trazo
const PIEL = "#f1c9a0";

export function PersonajeGanadero({ gesto, label }: { gesto?: string | null; label: string }) {
  return (
    <div className="relative mx-auto w-full select-none" role="img" aria-label={label}>
      <svg viewBox="0 0 200 330" className="block h-auto w-full overflow-visible" aria-hidden data-gesto={gesto ?? ""}>
        <ellipse cx="100" cy="322" rx="58" ry="6" fill="#000" opacity="0.18" />
        <g className="gn-cuerpo">
          {/* botas */}
          <path d="M64 290 L94 290 L96 314 C96 318 92 320 88 320 L58 320 C56 312 60 300 64 290Z" fill="#6b4423" stroke={T} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M136 290 L106 290 L104 314 C104 318 108 320 112 320 L142 320 C144 312 140 300 136 290Z" fill="#6b4423" stroke={T} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M57 316 L96 316 M104 316 L143 316" stroke="#2f1d0e" strokeWidth="4" strokeLinecap="round" />
          {/* pantalón caqui */}
          <path d="M64 204 L136 204 L134 296 L106 296 L100 238 L94 296 L66 296 Z" fill="#cdb98a" stroke={T} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M100 238 L100 206" stroke={T} strokeWidth="2.5" />
          {/* cuello y camisa */}
          <rect x="90" y="114" width="20" height="16" fill="#e3b88e" stroke={T} strokeWidth="3" />
          <path d="M60 142 C60 130 78 124 100 124 C122 124 140 130 140 142 L138 202 L62 202 Z" fill="#8fb8d8" stroke={T} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M100 134 L100 200" stroke={T} strokeWidth="2" opacity="0.7" />
          <circle cx="100" cy="152" r="2.2" fill={T} />
          <circle cx="100" cy="172" r="2.2" fill={T} />
          <circle cx="100" cy="190" r="2.2" fill={T} />
          <path d="M84 126 L100 144 L116 126 L110 121 L100 133 L90 121Z" fill="#e8f1f8" stroke={T} strokeWidth="2.5" strokeLinejoin="round" />
          {/* cinturón con hebilla */}
          <rect x="62" y="196" width="76" height="12" rx="3" fill="#4a2f1a" stroke={T} strokeWidth="3" />
          <rect x="93" y="197.5" width="14" height="9" rx="2" fill="#e0b34a" stroke={T} strokeWidth="2" />
          {/* carriel: correa cruzada y bolso */}
          <path d="M130 132 L78 190" stroke="#2f1d0e" strokeWidth="13" strokeLinecap="round" />
          <path d="M130 132 L78 190" stroke="#8a5a3b" strokeWidth="9" strokeLinecap="round" />
          <rect x="56" y="180" width="38" height="34" rx="6" fill="#8a5a3b" stroke={T} strokeWidth="3.5" />
          <path d="M56 188 C56 182 60 180 64 180 L86 180 C90 180 94 182 94 188 L94 198 L56 198Z" fill="#a87348" stroke={T} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="75" cy="199" r="3.2" fill="#e0b34a" stroke={T} strokeWidth="1.6" />
          <circle cx="64" cy="186" r="2.2" fill="#f4f4f1" />
          <circle cx="74" cy="184" r="2.2" fill="#2a2a2a" />
          <circle cx="84" cy="187" r="2.2" fill="#f4f4f1" />
          {/* brazo izquierdo con el lazo */}
          <path d="M62 146 C50 156 46 182 48 204" fill="none" stroke="#2f1d0e" strokeWidth="19" strokeLinecap="round" />
          <path d="M62 146 C50 156 46 182 48 204" fill="none" stroke="#8fb8d8" strokeWidth="14" strokeLinecap="round" />
          <circle cx="48" cy="209" r="9" fill={PIEL} stroke={T} strokeWidth="3" />
          <g className="gn-lazo">
            <ellipse cx="48" cy="232" rx="14" ry="17" fill="none" stroke="#7a5a2c" strokeWidth="7" />
            <ellipse cx="48" cy="232" rx="14" ry="17" fill="none" stroke="#d3b36e" strokeWidth="4" />
            <path d="M52 216 C60 222 58 240 62 252" fill="none" stroke="#d3b36e" strokeWidth="3.5" strokeLinecap="round" />
          </g>
          {/* brazo derecho (el que saluda) */}
          <g className="gn-brazo">
            <path d="M138 146 C150 156 154 182 152 204" fill="none" stroke="#2f1d0e" strokeWidth="19" strokeLinecap="round" />
            <path d="M138 146 C150 156 154 182 152 204" fill="none" stroke="#8fb8d8" strokeWidth="14" strokeLinecap="round" />
            <circle cx="152" cy="209" r="9.5" fill={PIEL} stroke={T} strokeWidth="3" />
          </g>

          {/* cabeza grande de caricatura */}
          <g className="gn-cabeza">
            <ellipse cx="55" cy="86" rx="7.5" ry="11.5" fill={PIEL} stroke={T} strokeWidth="3" />
            <ellipse cx="145" cy="86" rx="7.5" ry="11.5" fill={PIEL} stroke={T} strokeWidth="3" />
            <path d="M56 78 C56 42 144 42 144 78 C144 112 124 130 100 130 C76 130 56 112 56 78Z" fill={PIEL} stroke={T} strokeWidth="3.5" strokeLinejoin="round" />
            {/* canas */}
            <path d="M57 64 C47 73 49 95 58 101 C62 90 60 75 57 64Z" fill="#f4f4f1" stroke={T} strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M143 64 C153 73 151 95 142 101 C138 90 140 75 143 64Z" fill="#f4f4f1" stroke={T} strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx="73" cy="102" r="6.5" fill="#e58f86" opacity="0.45" />
            <circle cx="127" cy="102" r="6.5" fill="#e58f86" opacity="0.45" />
            {/* cejas pobladas */}
            <path d="M69 73 C77 65 90 66 96 72" fill="none" stroke="#c9c9c4" strokeWidth="6" strokeLinecap="round" />
            <path d="M104 72 C110 66 123 65 131 73" fill="none" stroke="#c9c9c4" strokeWidth="6" strokeLinecap="round" />
            {/* ojos */}
            <ellipse cx="82" cy="83" rx="8.8" ry="9.8" fill="#fff" stroke={T} strokeWidth="2.6" />
            <ellipse cx="118" cy="83" rx="8.8" ry="9.8" fill="#fff" stroke={T} strokeWidth="2.6" />
            <g className="gn-parpadeo">
              <g className="gn-pupila"><circle cx="83" cy="85" r="4.8" fill="#2a1a0e" /><circle cx="84.8" cy="83" r="1.6" fill="#fff" /></g>
            </g>
            <g className="gn-parpadeo gn-ojo-d">
              <g className="gn-pupila"><circle cx="119" cy="85" r="4.8" fill="#2a1a0e" /><circle cx="120.8" cy="83" r="1.6" fill="#fff" /></g>
            </g>
            {/* nariz y bigote */}
            <path d="M100 86 C91 98 91 106 100 108 C109 106 109 98 100 86Z" fill="#e9b58a" stroke={T} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M69 111 C77 100 92 102 100 107 C108 102 123 100 131 111 C125 122 110 119 100 114 C90 119 75 122 69 111Z" fill="#f7f7f4" stroke={T} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M89 124 C96 130 104 130 111 124" fill="none" stroke={T} strokeWidth="3" strokeLinecap="round" />
            {/* sombrero aguadeño */}
            <g className="gn-sombrero">
              <ellipse cx="100" cy="55" rx="68" ry="15" fill="#f3e6c0" stroke={T} strokeWidth="3.5" />
              <path d="M64 53 C62 14 138 14 136 53Z" fill="#f3e6c0" stroke={T} strokeWidth="3.5" strokeLinejoin="round" />
              <path d="M64.5 47 C80 55 120 55 135.5 47 L136 54 C120 63 80 63 64 54Z" fill="#2a2a2a" stroke={T} strokeWidth="2" strokeLinejoin="round" />
              <path d="M88 27 C96 33 104 33 112 27" fill="none" stroke={T} strokeWidth="2.6" strokeLinecap="round" />
            </g>
          </g>
          {/* bombillo de la idea */}
          <g className="gn-idea">
            <circle cx="166" cy="26" r="11" fill="#ffd95a" stroke={T} strokeWidth="3" />
            <rect x="161" y="37" width="10" height="6" rx="2" fill="#bdbdbd" stroke={T} strokeWidth="2" />
            <path d="M166 6 V0 M182 12 L187 7 M186 26 H194 M150 12 L145 7" stroke="#e0b34a" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    </div>
  );
}
