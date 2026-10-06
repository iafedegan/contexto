# Medición de Core Web Vitals (laboratorio)

Herramienta: Lighthouse 12, móvil emulado (3G rápido simulado, CPU ×4), contra producción `contexto-olive.vercel.app`, 5 de octubre de 2026.
Metas de la propuesta (sección 5): LCP ≤ 2,5 s · Lighthouse ≥ 90 · CLS bueno (< 0,1).

| Página | Rendimiento | LCP | FCP | CLS | TBT | Speed Index | Accesib. | Buenas prácticas | SEO |
|---|---|---|---|---|---|---|---|---|---|
| Inicio | 91 | **3,1 s** ✖ | 1,3 s | 0,009 | 40 ms | 4,7 s | 93 | 100 | 100 |
| Sección (Ganadería) | 93 | **3,1 s** ✖ | 1,3 s | 0,009 | 10 ms | 2,0 s | 96 | 100 | 100 |
| Artículo | 100 | 1,6 s ✔ | 1,3 s | 0,009 | 10 ms | 1,8 s | 96 | 100 | 100 |
| Búsqueda | 99 | 1,7 s ✔ | 1,3 s | 0,009 | 0 ms | 2,0 s | 96 | 100 | 61* |

\* La búsqueda no se indexa a propósito (`noindex`); es el motivo de la nota de SEO.

## Hallazgo
En Inicio y Sección el LCP (3,1 s) es la imagen de la nota de apertura. El desglose muestra **1,84 s de «retraso de carga del recurso»**:
la imagen se descubría tarde porque no llevaba `fetchpriority="high"` (en Next 16 `priority` solo precarga; no marca la prioridad).
Tiempo hasta el primer byte: 0,5 s (bueno). Peso de JS sin usar: 48 KiB (menor).

## Corrección aplicada (pendiente de desplegar y volver a medir)
`fetchPriority="high"` en las imágenes de apertura: tarjetas (`cover-art`, `home-card`, `tile-card`, `bento-tile`, `broadsheet-card`), carrusel de portada y portada del artículo.
Resultado esperado: LCP por debajo de 2,5 s en móvil. Tras el despliegue, repetir esta medición y registrar el resultado aquí.

## Reproducir
```bash
npm i lighthouse@12   # en una carpeta temporal
npx lighthouse https://contexto-olive.vercel.app/ --only-categories=performance,seo,accessibility,best-practices
```
Para el criterio de aceptación (HT-5) se recomienda además medir con datos de campo (Search Console / CrUX) cuando haya tráfico suficiente.
