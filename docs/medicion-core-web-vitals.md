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
