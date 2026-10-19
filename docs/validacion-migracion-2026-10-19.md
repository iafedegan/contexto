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

## 4. Hallazgos y estado

1. **438 notas tienen 535 imágenes dentro del texto que siguen apuntando al servidor del sitio anterior** (`a.storyblok.com`; 99 notas más con enlaces). Causa medida el 19/10: Storyblok responde **403 AccessDenied** a esas imágenes (y a las demás originales), por lo que la migración no pudo copiarlas. Es el mismo síntoma de «límites de Storyblok» que reporta el equipo del sitio actual. **No se pudo corregir hoy**: hay que repetir la copia cuando Storyblok vuelva a entregar los archivos o con una exportación de FEDEGÁN. Quedó listo el script `scripts/migracion/reparar-imagenes.ts` (con prueba): sondea primero, y con `--aplicar --produccion` copia las imágenes al bucket propio y reescribe las notas; con `--portadas` también recupera portadas. Requiere las credenciales de Supabase de quien carga.
2. **7.391 notas (14 %) tienen un título SEO distinto del titular.** El sitio actual muestra el titular en `<title>` y `og:title`. Se verificó en las 22 notas de la muestra donde difieren: el sitio actual muestra siempre el titular. Respaldo creado en producción (`articles_meta_title_respaldo`, 7.391 filas) y SQL listo en `docs/sql-titulo-seo.sql` (4 tandas) para volver al titular; **pendiente de ejecutar** (el cambio masivo lo bloqueó el control de permisos) y de la decisión de FEDEGÁN.
3. **2.911 notas sin imagen de portada.** 2.670 son columnas: el sitio actual les pone el logo como imagen al compartir, no una foto, así que no hay pérdida (el portal nuevo no pone imagen al compartir: ver pendiente). Las 241 restantes (blog, galería, secciones): en una muestra de 8 revisadas, 3 sí tenían foto propia en el sitio actual; se recuperan con `reparar-imagenes.ts --portadas` cuando Storyblok responda.
4. **«7 notas con un párrafo distinto»: falso positivo.** El párrafo que «faltaba» es texto del sitio anterior que no es parte de la nota («versión clásica en vivo, foto contextoganadero.com»); las otras dos revisadas ya coinciden por completo. No hay pérdida de texto comprobada.

## 5. Qué no cubre

- Cobertura de indexación en Search Console (requiere el corte de dominio).
- Revisión editorial humana: el muestreo de arriba es automático.
- La herramienta `migracion:verificar` (conciliación contra el archivo descargado) no se corrió: la caché de descarga no está en este equipo; la conciliación se hizo contra los mapas públicos del sitio actual y la base de producción.
