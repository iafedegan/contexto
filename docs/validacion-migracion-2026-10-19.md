# Validación de la migración — contextoganadero.com → portal nuevo

Fecha: **19 de octubre de 2026**. Origen: `https://www.contextoganadero.com` (sitio actual). Destino: `https://contexto-olive.vercel.app` (portal nuevo, base en producción).
Alcance: obligación 10 («Validación e integridad de la migración»). Todo lo de abajo se midió ese día; no hay cifras estimadas.

## 1. Conciliación de direcciones (sitio actual contra portal nuevo)

| Control | Resultado |
|---|---|
| Direcciones en los mapas del sitio actual (6 archivos) | 51.536 (51.535 notas + la portada) |
| Notas publicadas en el portal nuevo (mapas del nuevo) | 51.382 (51.381 migradas + 1 nota creada ya en el portal nuevo) |
| Direcciones con la **misma dirección exacta** en el nuevo | 51.325 |
| Direcciones que el nuevo no lista en su mapa | 154 (más la portada) |
| …de esas 154, las que redirigen (308) a su copia y esa copia responde 200 | **154 de 154** |
| Direcciones antiguas que dan error (404/500) en el nuevo | **0** |

Las 154 son notas que el sitio actual publicaba **repetidas en dos secciones** (128 de «Galería»): el portal nuevo conserva una sola copia y redirige la otra, por diseño. Cuadra exacto: 51.535 − 154 = 51.381 notas migradas.

## 2. Calidad del contenido migrado (base de producción, 51.381 notas)

| Control | Resultado |
|---|---|
| Con dirección original guardada | 51.381 de 51.381 |
| Publicadas / con categoría / con autor / con fecha / con resumen | 100 % en todas |
| Rango de fechas | 24/10/2012 a 12/10/2026 |
| Imagen de portada apuntando al servidor del sitio anterior | **0** |
| Cuerpo casi vacío (< 200 caracteres) | 5 (en el sitio actual también son notas de una línea o pruebas, p. ej. «prueba columna-paola») |
| Sin imagen de portada | 2.911 (5,7 %) |

## 3. Muestreo nota por nota (150 notas al azar, semilla fija; sitio actual contra nuevo)

| Control | Resultado |
|---|---|
| Responden 200 en ambos sitios | 150 de 150 |
| Titular (h1) idéntico | 150 de 150 (las diferencias de la primera lectura eran el h1 vacío del sitio antiguo) |
| Fecha de publicación idéntica | 150 de 150 |
| Párrafos de cuerpo del sitio actual que están en el nuevo | **1.215 de 1.222 (99,4 %)**; 143 de 150 notas completas; en las otras 7 falta un párrafo |
| Imagen principal (`og:image`) | sitio actual 150; nuevo 142 (las 8 que faltan son columnas sin foto) |

Los párrafos «faltantes» de una primera medición eran tarjetas de notas relacionadas y carruseles del sitio anterior, no texto de las notas.

## 4. Hallazgos que requieren acción

1. **438 notas tienen 535 imágenes dentro del texto que siguen apuntando al servidor del sitio anterior** (`a.storyblok.com`), y 99 notas tienen enlaces a ese mismo servidor. Cuando se cancele el sitio anterior esas imágenes dejarán de verse. Corrección: correr de nuevo el paso de imágenes de la migración (`scripts/migracion/imagenes.ts`) para esas notas, con las credenciales de Supabase de quien hace la carga.
2. **7.391 notas (14 %) tienen un título SEO distinto del titular.** El sitio actual muestra el titular en `<title>` y `og:title`; el portal nuevo usa el título SEO migrado (p. ej. «Tips para la siembra…» frente al titular «Recomendaciones para la siembra…»). Decisión de FEDEGÁN: conservar el título SEO o volver al titular.
3. **2.911 notas sin imagen de portada** (5,7 %): confirmar con la redacción si ya carecían de imagen en el sitio anterior (en la muestra, las 8 sin imagen eran columnas).
4. **7 notas de la muestra (5 %) con un párrafo distinto**: revisión editorial con una persona de la redacción (muestreo con acta). Las notas: `/economia/la-fertilizacion-in-vitro-tiene-un-gran-futuro-en-la-ganaderia-colombiana`, `/regiones/ong-italiana-contribuye-al-desarrollo-de-asociaciones-ganaderas`, `/ganaderia-sostenible/cinco-ventajas-de-implementar-un-sistema-de-trazabilidad-alimentaria`, `/columna/una-ley-necesaria`, `/gremialidad/ganaderos-entregaron-45-000-litros-de-leche-y-50-000-unidades-de-queso-caqueteno-en-el-choco`, `/agricultura/augusto-solano-recibe-el-premio-embajador-del-american-floral-endowment-2024-…`, `/regiones/asi-va-la-direccion-tecnica-de-fedegan-avances-regionales-y-proyectos-destacados`.

## 5. Qué no cubre

- Cobertura de indexación en Search Console (requiere el corte de dominio).
- Revisión editorial humana: el muestreo de arriba es automático.
- La herramienta `migracion:verificar` (conciliación contra el archivo descargado) no se corrió: la caché de descarga no está en este equipo; la conciliación se hizo contra los mapas públicos del sitio actual y la base de producción.
