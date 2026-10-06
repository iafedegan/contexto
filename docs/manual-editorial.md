# Manual editorial — CONtexto Ganadero

Para redactores y editores. Se entra en `/panel` con correo, contraseña y el código de la app de autenticación (2FA).

## 1. Qué puede hacer cada rol
| Rol | Puede |
|---|---|
| **Redactor** | Crear y editar sus notas y enviarlas a revisión. No publica. |
| **Editor** | Todo lo anterior + publicar, programar, retirar y eliminar notas; aprobar borradores de IA; avisos, portada y plantillas, secciones, newsletter, mensajes. |
| **Administrador** | Todo, más usuarios, ajustes del sitio, API pública y límites de IA. |
El administrador puede ajustar permisos persona por persona (Configuración → Personas y roles).

## 2. Resumen
Muestra lecturas de los últimos 7 días, notas por estado, las más leídas, pendientes (notas en revisión y borradores de IA) y el mapa de dónde se suscriben los lectores.

**¿Desde dónde los leen?** En Artículos, al pulsar la gráfica de una nota se ve el origen de sus lecturas: buscadores, redes, campañas (UTM), boletín, push y **Lector RSS** (Feedly, Inoreader…). Una lectura solo se cuenta cuando alguien abre la nota en el sitio y se queda unos segundos. Lo que se lee *dentro* del lector RSS (el resumen) no llega al sitio y no se puede contar; los enlaces de los feeds llevan `utm_source=rss`, así que al pulsar «Leer la nota completa» la visita queda registrada como «Lector RSS». Las notas que un lector ya había descargado antes de este cambio conservan su enlace anterior y se cuentan como «Directo».

## 3. Crear una nota (asistente de 9 pasos)
**Artículos → Nuevo artículo**. Hay dos modos: *manual* y *con IA*. Cada paso cabe en pantalla; lo largo se recorre con carruseles. Se guarda solo como borrador mientras escribes.

**Con IA** — el primer paso parte de uno de estos orígenes:
- **Tema escrito** (mínimo 10 caracteres): describe qué pasó, dónde, cuándo y según quién.
- **Ideas de la IA**: temas en tendencia con sus fuentes.
- **Buscar noticias**: eliges cuáles *referenciar* o cuál usar *como tema* (se lee la página de esa noticia para poder citarla).
- **Voz o video**: indicas quiénes intervienen, subes la grabación, la IA la divide por intervenciones y **tú asignas quién dijo cada fragmento**.
- **Enlaces**: hasta 5 páginas que la IA lee y reescribe con palabras propias.
Luego eliges **título** y **enfoque** (o escribes los tuyos) y, si quieres, **«Cómo quieres que se escriba»** (tono, estructura, qué citar).

**Pasos siguientes (ambos modos):** Resumen · Palabras clave · Imagen · Sección y autor · Cuerpo · Gráfica · Buscadores · Vista previa.
- **Cuerpo**: editor como un procesador de texto (intertítulo, negrita, cursiva, cita, listas, enlace, deshacer). Con IA, el campo «Dile a la IA cómo escribirlo» reescribe el cuerpo respetando los hechos.
- **Citas**: la IA solo mantiene citas textuales que aparecen literalmente en las fuentes; las demás las corrige o las quita.
- **Gráfica**: la IA busca cifras en la web y las dibuja; verifica las fuentes antes de insertarla.
- **Buscadores**: título SEO y descripción; a la derecha, así se ve en Google. El panel SEO muestra qué falta y en qué paso corregirlo.
- **Vista previa**: la nota tal como se verá en el sitio. Desde aquí: **Guardar borrador**, **Enviar a revisión** (redactor) o **Publicar / Programar** (editor). Programar usa hora de Colombia.

## 4. Lista de artículos
Filtros por estado, sección, autor y orden. Por nota: abrir, **Última hora** y **En vivo** (interruptores, solo editores), ver en el sitio y eliminar. Marcar «Última hora» desde la lista no envía notificación push; el aviso sale al publicar.

## 5. Borradores de IA
**Borradores de IA** es la cola de lo que generan los agentes. Para cada borrador ves la fuente, el modelo y las **cifras verificadas o no**. **Aprobar** crea la nota en borrador firmada con tu ficha de autor; **Rechazar** exige un motivo. Nada se publica sin que un editor lo apruebe y lo publique.

## 6. Portada, plantillas y secciones
**Portada y plantillas**: elige la plantilla, pulsa una pieza en la página y ajusta fuente, tamaño y color; «Más opciones de texto» tiene grosor, mayúsculas, espaciado y degradado. Los cambios quedan en **borrador** hasta pulsar **Publicar cambios** (muestra la lista de lo que cambia). **Descartar** o «Deshacer la última publicación» (menú «Más») revierten. **Secciones** gestiona el menú y sus subsecciones.

## 7. Newsletter, avisos y mensajes
Ediciones y suscriptores (con mapa), avisos del sitio (franja o ventana emergente) y mensajes de contacto y de pauta.

## 8. Buenas prácticas
Título de 15 a 65 caracteres · resumen de 70 a 155 · 3 a 6 palabras clave · imagen con texto alternativo · firma (autor) y fuentes citadas · cifras con unidad, periodo y entidad.
