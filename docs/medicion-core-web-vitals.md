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

## 7. Tercera medición (18 de octubre de 2026, producción, tras la migración de 51 mil notas)

Lighthouse 12, móvil simulado (mismo modo que PageSpeed Insights), Chrome sin interfaz, contra `contexto-olive.vercel.app`. Cada fila es una corrida real.

| Página | Corrida | Rendimiento | Accesibilidad | LCP | CLS | TBT |
|---|---|---|---|---|---|---|
| Portada | 1 | 85 | — | 3.41 s | 0.000 | 51 ms |
| Portada | 2 | 99 | — | 1.91 s | 0.000 | 73 ms |
| Portada | 3 | 100 | — | 1.74 s | 0.000 | 24 ms |
| Portada | 4 | 99 | — | 1.84 s | 0.000 | 10 ms |
| Portada | 5 | 100 | — | 1.61 s | 0.000 | 11 ms |
| Portada | 6 | 100 | — | 1.47 s | 0.000 | 2 ms |
| Portada | 7 | 100 | — | 1.49 s | 0.000 | 19 ms |
| Portada | 8 | 100 | — | 1.64 s | 0.000 | 2 ms |
| Sección Colombia | 1 | 95 | 100 | 2.80 s | 0.000 | 4 ms |
| Sección Colombia | 2 | 100 | 100 | 1.48 s | 0.000 | 5 ms |
| Artículo migrado | 1 | 89 | 100 | 2.09 s | 0.000 | 29 ms |
| Artículo migrado | 2 | 100 | 100 | 1.45 s | 0.000 | 7 ms |
| Observatorio | 1 | 99 | 100 | 1.61 s | 0.014 | 35 ms |
| Observatorio | 2 | 99 | 100 | 1.63 s | 0.015 | 48 ms |
| Sección TV | 1 | 91 | 100 | 2.93 s | 0.000 | 4 ms |
| Sección TV | 2 | 99 | 100 | 1.55 s | 0.000 | 3 ms |

**Lectura.** Portada: mediana LCP 1,69 s y 7 de 8 corridas ≤ 2,5 s. La primera corrida de cada página (servidor en frío) es la que sale alta (2,8–3,4 s); las siguientes, 1,45–1,9 s. En la corrida lenta de la portada el desglose del LCP fue TTFB 0,79 s, retraso de carga 1,83 s, carga 0,12 s y retraso de pintado 0,67 s, y la portada llega sin caché de borde (`x-vercel-cache: MISS` en cada petición, pese a la cabecera `Vercel-CDN-Cache-Control` que pone `src/proxy.ts`). Siguiente paso: hacer que la caché de borde funcione y volver a medir.
