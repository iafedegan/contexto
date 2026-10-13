# Medición de Core Web Vitals (laboratorio)

Herramienta: Lighthouse 12, móvil emulado, contra producción `contexto-olive.vercel.app`, 5 de octubre de 2026.
Dos modos: **simulado** (el que usa PageSpeed Insights: red 4G lenta y CPU ×4 calculados) y **con red limitada real** (el navegador aplica la limitación).
Metas de la propuesta (§5): LCP ≤ 2,5 s · Lighthouse ≥ 90 · CLS bueno (< 0,1).

## 1. Antes de corregir
| Página | Rendimiento | LCP | CLS | Speed Index |
|---|---|---|---|---|
| Inicio | 91 | **3,1 s** ✖ | 0,009 | 4,7 s |
| Sección (Ganadería) | 93 | **3,1 s** ✖ | 0,009 | 2,0 s |
| Artículo | 100 | 1,6 s | 0,009 | 1,8 s |
| Búsqueda | 99 | 1,7 s | 0,009 | 2,0 s |

Causa: la imagen de apertura se descubría tarde (1,84 s de «retraso de carga del recurso»).

## 2. Correcciones aplicadas
1. `fetchPriority="high"` en las imágenes de apertura (en Next 16 `priority` solo precarga; no sube la prioridad).
2. La nota de apertura ya no hace la animación de entrada (`lx-reveal`): con opacidad 0 al inicio, el LCP esperaba a que terminara.
3. Se precarga la tipografía de los titulares (Playfair), que se descubría recién al leer el CSS. Ahora sale como cabecera `Link: rel=preload` en la primera respuesta.
4. Imágenes de tarjetas a calidad 75.

## 3. Después de corregir
| Página | Corridas simuladas (LCP) | Mediana | Con red limitada real | Rendimiento (mín.) | CLS |
|---|---|---|---|---|---|
| Inicio | 1,82 · 1,82 · 1,83 · 1,84 · 1,87 · 2,04 · 2,42 · **2,87** | **1,85 s** | 2,0 s | 95 | 0,009 |
| Sección (Ganadería) | 1,74 · 1,76 · 1,77 · 1,81 · 1,81 · 2,06 · 2,06 | **1,81 s** | 2,2 s | 99 | 0,009 |
| Artículo | 1,6 · 1,6 | 1,6 s | — | 100 | 0,01 |
| Búsqueda | 1,95 · 2,0 | 2,0 s | — | 98-99 | 0,01 |

**Resultado:** el LCP cumple (≤ 2,5 s) en las cuatro páginas. En 14 de 15 corridas válidas de Inicio y Sección quedó bajo 2,5 s;
la excepción es una corrida de Inicio con 2,87 s. El modelo de simulación de Lighthouse es sensible: cuando el navegador pinta unos
cientos de milisegundos más tarde, incluye en el cálculo los primeros scripts (≈ 230 KB en 15 archivos, de baja prioridad) y suma ≈ 1 s.
Por eso una medición única de PageSpeed puede salir por encima de la meta de forma ocasional aunque lo habitual sea 1,8 s.

## 4. Si se quiere más margen (no aplicado)
- Servir la portada desde la caché de borde (ISR con revalidación al publicar): hoy se genera en cada visita (`force-dynamic`) para evitar que el build consulte la base.
- Reducir el JavaScript inicial (carrusel de portada con carga diferida).

## 5. Reproducir
```bash
npm i lighthouse@12   # en una carpeta temporal
npx lighthouse https://contexto-olive.vercel.app/ --only-categories=performance
npx lighthouse https://contexto-olive.vercel.app/ --throttling-method=devtools   # red limitada real
```
Para el criterio de aceptación (HT-5) conviene además registrar datos de campo (Search Console / CrUX) cuando haya tráfico suficiente.

## 6. Segunda revisión (13 de octubre de 2026)

La portada volvió a medirse por encima de la meta en PageSpeed (LCP simulado de 2,7-3,0 s en 4 corridas seguidas) aunque el navegador real la pintaba a los 0,67 s. El modelo simulado de Lighthouse suma todo lo que se pide antes del primer pintado (tipografías, CSS y JavaScript) y las corridas varían mucho según el momento (1,8-3,0 s en el mismo sitio).

**Causa en el camino real.** Con red y CPU limitadas de verdad (`--throttling-method=devtools`), el primer pintado (LCP = FCP = 2,07 s) llegaba justo cuando terminaban el CSS y las dos tipografías precargadas (84 KB): compartían el ancho de banda y el CSS, que es lo único que bloquea el pintado, terminaba junto con ellas.

**Cambios.**
1. Las tipografías web se piden después de que la página pintó y cargó (`fuentes-tras-la-carga` en `src/app/layout.tsx` y `html:not([data-fuentes])` en `globals.css`). Hasta entonces el texto usa la tipografía de respaldo de next/font, con las métricas ajustadas (CLS 0,001). Quien ya las tiene en caché las pide desde el principio (marca `cg-fuentes` en localStorage) y no ve ningún cambio.
2. La mascota flotante, los avisos de consentimiento, los avisos de la app y la ventana emergente cargan su código después de la carga (`src/components/diferido.tsx`).
3. `MENU_SECUNDARIO` salió de `institucional.ts` a `menu-secundario.ts`: un componente de cliente arrastraba al navegador los 47 KB de textos legales.

**Resultado (compilación local contra la base de producción, móvil, 6 corridas).**

| Medición | Antes | Después |
|---|---|---|
| LCP con red y CPU limitadas de verdad (mediana) | 2,07 s | **1,71 s** |
| LCP simulado (el de PageSpeed), local | 3,62 s | 3,21 s |
| CLS | 0 | 0,001 |

El LCP simulado local es más alto que el de producción (no hay CDN ni HTTP/2) y sirve solo para comparar. Lo que queda en el modelo simulado es sobre todo el código de React y de Next (≈ 190 KB comprimidos), que no se puede reducir. El siguiente paso con más efecto sería servir la portada desde la caché de borde (ver sección 4).

**Reproducir la medición realista.**
```bash
npx lighthouse http://localhost:3999/ --only-categories=performance --throttling-method=devtools \
  --throttling.rttMs=150 --throttling.requestLatencyMs=562.5 --throttling.downloadThroughputKbps=1474.56 \
  --throttling.uploadThroughputKbps=675 --throttling.cpuSlowdownMultiplier=4
```
