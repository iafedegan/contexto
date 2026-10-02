# Auditoría de adaptabilidad (responsive)

Mide, con **Chrome real**, qué pasa en cada página del portal y del panel a distintos tamaños de pantalla
(teléfono pequeño, teléfono, horizontal, tableta, portátil, escritorio). Sirve para comprobar que un cambio
no rompe lo que ya funcionaba: se corre antes y después y se comparan los números.

## Qué mide en cada página y tamaño

| Métrica | Qué significa |
|---|---|
| `desbordes` | Elementos con contenido que se salen del ancho de la pantalla y nada los contiene. **Ojo:** el portal recorta en horizontal (`overflow-x: clip` en `.lx-shell`), así que un desborde NO aparece como barra de scroll: el contenido simplemente queda cortado. Por eso se mide cada elemento, no `scrollWidth`. |
| `choques` | Textos que se pisan entre sí (rótulo sobre titular, contador sobre una tarjeta…). |
| `recortes` | Texto cortado por su propia caja (palabras largas dentro de `line-clamp`, etiquetas con `overflow: hidden`). |
| `txt peq.` | Textos por debajo de 12 px (11 px si van en MAYÚSCULAS). |
| `tap<24` / `tap<36` | Controles táctiles de menos de 24 px / 36 px (mínimo WCAG 2.5.8: 24 px; recomendado por Apple/Material: 44 px). Los enlaces dentro de un párrafo no cuentan. |
| `iosZoom` | Campos con letra menor de 16 px: Safari en iPhone hace zoom al enfocarlos. |
| `chrome%` | Porcentaje de la altura de la pantalla que ocupan las barras fijas/pegajosas al desplazarse (cabecera, avisos…). |

Los tamaños de pantalla emulan táctil (`pointer: coarse`) en teléfono y tableta, y ratón en escritorio.

## Cómo se usa

```bash
npm i -D puppeteer-core        # una vez (no forma parte de las dependencias del proyecto)
npm run dev                    # o apunta AUDIT_BASE_URL a otro servidor

export AUDIT_BASE_URL=http://localhost:3000
export AUDIT_TOTP_SECRET=...   # solo para el panel: secreto base32 del 2FA de la cuenta de prueba
node scripts/responsive-audit/specs.mjs                                   # genera .audit/specs/*.json
AUDIT_RUN=antes node scripts/responsive-audit/sweep.mjs .audit/specs/publico.json
AUDIT_RUN=antes node scripts/responsive-audit/sweep.mjs .audit/specs/panel.json
# ...cambios...
AUDIT_RUN=despues node scripts/responsive-audit/sweep.mjs .audit/specs/publico.json

node scripts/responsive-audit/scorecard.mjs antes   "ANTES"   publico.ndjson,panel.ndjson
node scripts/responsive-audit/scorecard.mjs despues "DESPUÉS" publico.ndjson,panel.ndjson
node scripts/responsive-audit/report.mjs despues publico.ndjson detail   # qué elemento exacto falla y dónde
```

Los resultados y las capturas (una pantalla por desplazamiento, en `shots/`) quedan en `.audit/` (ignorado por git).

## Notas

- El limitador por IP del proxy (120 peticiones/minuto) se esquiva enviando una `x-forwarded-for` distinta por carga: solo funciona en local.
- Las tandas por plantilla (`plantilla-*.json`) publican cada plantilla desde el editor de portada: usa una base de datos local, nunca producción.
- Para probar contenido extremo, pega en un artículo de prueba una tabla ancha, un `<iframe width="560">`, un bloque `<pre>` y una URL larguísima.
