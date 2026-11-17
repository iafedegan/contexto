# Auditoría de accesibilidad — 17/11/2026

**Alcance.** Sitio público en producción (contexto-olive.vercel.app): portada, sección, economía, nota, columna, búsqueda, Observatorio, asistente, contacto, preguntas frecuentes y quiénes somos. Escritorio (1440 px) y celular (390 px), modo claro y oscuro. Herramienta: axe-core 4.13 con las etiquetas WCAG 2.0/2.1/2.2 A y AA más buenas prácticas.

**Límites.** axe detecta solo una parte de los criterios (alrededor de un tercio). No se probó con lector de pantalla (NVDA, VoiceOver), no se recorrió el sitio solo con teclado y no se auditó el panel de administración. `/buscar` en escritorio oscuro agotó el tiempo de carga (60 s) y quedó sin medir. **Esta auditoría no certifica WCAG 2.1 AA ni la NTC 5854.**

## Hallazgos

| # | Gravedad | Regla | Qué pasa | Dónde |
|---|---|---|---|---|
| 1 | Seria | Tamaño de objetivo táctil (WCAG 2.2, 2.5.8) | Los botones «ver subsecciones» del menú miden 20×20 px; el mínimo es 24×24 | Barra de navegación, todas las páginas (156 casos) |
| 2 | Seria | Contraste (WCAG 1.4.3) | Texto blanco sobre dorado `#d9a41a`: 2,26:1 (se pide 4,5:1) | Etiquetas de sección (p. ej. «Columnas») en portada |
| 3 | Seria | Contraste | Etiquetas `.lx-chip` en gris `#999794` sobre `#26362f`: 4,36:1 | Notas y columnas |
| 4 | Seria | Contraste | Verde `#138984` sobre `#081b13`: 4,19:1 en texto de 18 px normal | Lista de columnas |
| 5 | Seria | Región desplazable con teclado | El carrusel de imágenes de la portada se desplaza pero no tiene contenido enfocable | Portada |
| 6 | Moderada | Puntos de referencia únicos | Dos regiones con el mismo nombre accesible «Carrusel de imágenes» | Portada |
| 7 | Moderada | Contenido dentro de landmarks | Elementos fuera de `header`/`main`/`footer` (contenedor `.pr-8.gap-8`, `.bottom-full`, `.h-0`) | 2–3 por página |

## Lo que está bien

- Enlace «Saltar al contenido» e idioma `es-CO` declarado.
- Sin imágenes sin `alt` en el código, sin `div` clicables sin rol en el sitio público.
- Foco visible global (`:focus-visible`), también donde se usa `outline-none`.
- `prefers-reduced-motion` respetado (25 lugares).
- Sin violaciones de nombre accesible en botones, enlaces ni imágenes, ni de orden de encabezados, ni de formularios en las páginas medidas.

## Correcciones aplicadas (hallazgos 1 a 6)

1. Botón «ver subsecciones»: de 20 a 24 px (`nav-menu-item.tsx`).
2. Etiquetas de sección sobre dorado: el color de texto del `Kicker` pasa a ser prioritario (`!text-[var(--accent-fg)]`), para que no lo pise el blanco heredado (`article-card.tsx`).
3. Chips: texto mezclado con `--fg` en vez de `--fg-muted` (`globals.css`).
4. Números de «Relacionadas»: color de acento en vez de `--accent-2` (`articulo.tsx`).
5. Carrusel de la portada: el contenedor desplazable es enfocable con teclado y tiene nombre (`pagina-interactivos.tsx`).
6. Carrusel: `role="group"` en vez de `region`, para que no se repita como punto de referencia (el hallazgo 7, elementos fuera de los landmarks, sigue pendiente).

Falta volver a correr axe sobre el despliegue nuevo para confirmar que quedaron en cero.

## Prueba de teclado (automatizada, en producción)

Se recorrieron 120 tabulaciones en portada, sección, nota y contacto: el primer foco es «Saltar al contenido», ningún elemento enfocado queda oculto y todos muestran indicador de foco. No es una prueba humana: no valida el orden lógico ni que el menú, el carrusel y el asistente se manejen bien solo con teclado.

## NTC 5854 (criterios de WCAG 2.0 A/AA)

La NTC 5854 define sus requisitos con base en WCAG 2.0 (niveles A, AA y AAA). Lo medido cubre solo los criterios que axe automatiza.

| Principio | Estado |
|---|---|
| Perceptible: alternativas de texto, contraste, redimensión | Parcial: axe verificó alt, contraste y nombres. Fallos de contraste ya corregidos (sin reverificar). Falta revisar video/audio (subtítulos, transcripción) en TV y Radio |
| Operable: teclado, tiempo, destellos, navegación | Parcial: foco y enlace de salto verificados. Falta revisión humana de trampas de teclado, el carrusel automático (pausa) y los destellos |
| Comprensible: idioma, previsibilidad, errores | Parcial: idioma correcto. Falta revisar mensajes de error y ayuda en formularios (contacto, búsqueda, asistente) |
| Robusto: HTML válido, nombre/rol/valor | Cumple lo que axe mide en las páginas probadas |

**Esto no es una declaración de conformidad.** Para declararla hace falta que una persona revise cada criterio, incluida la prueba con lector de pantalla.

## Pendiente (lo que no puede hacer una herramienta automática)

1. **Lector de pantalla:** probar con NVDA (Windows) y VoiceOver (Mac y iPhone) el menú con submenús, el carrusel, la búsqueda, el asistente y una nota.
2. **Panel de administración:** requiere iniciar sesión; auditar el constructor, el editor de notas y los formularios, y añadir un aviso de contraste al elegir colores.
3. **Video y audio:** subtítulos y transcripción en TV y Radio.
4. **Hallazgo 7** (elementos fuera de los landmarks) y volver a medir `/buscar` en escritorio oscuro.
5. Añadir axe en CI y `eslint-plugin-jsx-a11y`.
