---
codigo: CG-DOC-03
titulo: Manual editorial
subtitulo: Guía de uso del panel para redactores y editores: de la idea a la nota publicada, el consejo de redacción, la portada y el boletín
version: 1.0
audiencia: Redactores y editores de CONtexto Ganadero (y su capacitación, CG-DOC-08)
---

# 1. Cómo usar este manual

Está escrito para quien **trabaja a diario en el panel** (`/panel`). Cada capítulo sigue el orden real del trabajo: entrar, escribir, revisar, publicar, planear la semana y cuidar la portada. Al final de cada capítulo hay una lista de **comprobaciones** para saber si la tarea quedó bien hecha, y el capítulo 13 reúne los problemas frecuentes. Los conceptos de seguridad están en CG-DOC-05 y la administración de personas y ajustes en CG-DOC-04.

**Regla que gobierna todo el sistema:** *ningún contenido generado por inteligencia artificial se publica sin que una persona con permiso lo revise y lo publique.* La IA propone; la redacción decide.

# 2. Entrar al panel y proteger tu cuenta

1. Abre `/panel`, escribe tu **correo** y tu **contraseña** y, si está activado, el **código de 6 dígitos** de tu aplicación de autenticación. También puedes entrar con una **passkey** (huella, rostro o PIN del dispositivo).
2. **El segundo factor (2FA) es obligatorio.** Si tu cuenta aún no lo tiene, el panel te lleva a *Configuración → Seguridad* y no te deja usar nada más hasta activarlo (un administrador puede dar un plazo de gracia, con fecha).
3. Cambia tu contraseña temporal en *Configuración → Mis datos*. Usa una contraseña única y larga.
4. Tu sesión dura 8 horas. Al terminar, usa **Salir** (menú lateral).
5. Si te equivocas 5 veces seguidas, la cuenta se bloquea 15 minutos: espera o pide ayuda a un administrador.

**Comprobaciones:** puedes entrar con 2FA; viste tu nombre y rol en el menú lateral; tienes una **ficha de autor** a tu nombre (el sistema la crea sola; es la firma de tus notas).

# 3. Qué puede hacer cada rol

| Rol | Puede |
|---|---|
| **Redactor** | Crear y editar **sus** notas, usar la IA para redactar y enviarlas a revisión. No publica |
| **Editor** | Lo anterior más publicar, programar, retirar y borrar notas; aprobar borradores de IA; avisos, portada y plantillas, secciones, newsletter, mensajes y centro de análisis |
| **Administrador** | Todo, más personas y roles, ajustes del sitio, claves de IA, API pública y límites |

Un administrador puede ajustar permisos **persona por persona** (por ejemplo, dar el newsletter a un redactor o quitar «publicar» a un editor). Si ves que un menú no aparece, probablemente no tienes ese permiso.

# 4. El menú lateral y el Resumen

El menú muestra, según tus permisos: **Resumen**, **Artículos**, **Mis pendientes** (con un número rojo si tienes tareas), **Consejo de redacción**, **Newsletter**, **Portada y plantillas** y **Configuración**.

**Resumen** reúne: lecturas de los últimos 7 días y su variación frente a la semana anterior, notas por estado (publicadas, en revisión, programadas, borradores), la gráfica «Lecturas por día», las notas más leídas de 30 días y las preguntas al asistente. Cada tarjeta lleva a la lista correspondiente. Si tienes permiso de análisis verás también las pestañas **Audiencia**, **Lectores** y **Suscriptores**.

# 5. Estados de una nota

| Estado | Significado | Quién lo cambia |
|---|---|---|
| **Borrador** | En redacción; solo la ve su autor y los editores | Se guarda solo al escribir |
| **En revisión** | Enviada al editor | El redactor, con «Enviar a revisión» |
| **Programada** | Fija para salir a una fecha y hora de Colombia | El editor |
| **Publicada** | Visible en el sitio | El editor |
| **Archivada** | Retirada del sitio, sin borrarla | El editor |

Una nota publicada solo la edita quien puede publicar. Enviar a revisión una nota ya publicada **no** la saca del sitio.

# 6. Crear una nota: el asistente de 9 pasos

**Artículos → Nuevo artículo.** Eliges entre **manual** y **con IA**. Cada paso cabe en la pantalla (lo largo se recorre con carruseles) y la nota se **guarda sola como borrador** en cuanto tiene un título de al menos 5 caracteres. Verás «Se guarda al escribir el título» y la hora del último guardado.

## 6.1 Paso 1 · Título y contexto
Con IA, el primer paso parte de uno de estos orígenes:
- **Tema escrito** (mínimo 10 caracteres). Cuanto más concreto (qué pasó, dónde, cuándo, según quién), mejores títulos.
- **Ideas de la IA:** temas en tendencia con sus fuentes. En esta pantalla puedes pedir a la IA «Autollenar el resto» (responde las preguntas del tema investigando en la web) o «Aconséjame temas».
- **Buscar noticias:** investiga una persona, empresa o tema en medios, YouTube y fuentes oficiales; eliges cuáles **referenciar** o cuál usar **como tema**.
- **Voz o video:** subes una grabación, la IA la divide por intervenciones y **tú asignas quién dijo cada fragmento** antes de usarla.
- **Enlaces:** hasta 5 páginas que la IA lee y reescribe con palabras propias (no copia).

Las **preguntas del tema** (hechos y cifras clave, para quién se escribe, géneros, extensión, alcance, lugares, gráfica, tono, fuentes a consultar y qué evitar) orientan a la IA. Luego pulsas **Proponer títulos y contextos**, eliges un título y un enfoque (o escribes los tuyos) y, si quieres, indicas «Cómo quieres que se escriba».

## 6.2 Pasos 2 a 9
| Paso | Qué haces | Qué verificar |
|---|---|---|
| 2 · Resumen | Revisas o escribes el resumen | De 70 a 155 caracteres; dice lo esencial |
| 3 · Palabras clave | Eliges 3 a 6 etiquetas | Reflejan lo que buscaría un productor |
| 4 · Imagen | Subes, buscas o generas la portada; escribes el texto alternativo | Imagen sin derechos en conflicto y con descripción |
| 5 · Sección y autor | Eliges la **sección** (y subsección, región y departamento) donde se publica | La **firma es siempre tu ficha de autor**: no se elige |
| 6 · Cuerpo | Editor tipo procesador de texto: intertítulo, negrita, cursiva, cita, listas, enlace, deshacer | Las citas textuales existen en las fuentes |
| 7 · Gráfica | La IA busca cifras en la web y dibuja la gráfica, con su fuente | Unidad, periodo y entidad de cada cifra |
| 8 · Buscadores | Título SEO y descripción para Google; ves cómo se verá | Panel SEO sin criterios críticos pendientes |
| 9 · Vista previa | La nota tal como se verá en el sitio | Guardar borrador, **Enviar a revisión** (redactor) o **Publicar / Programar** (editor) |

**Controles de calidad de la IA.** Solo se conservan las citas textuales que aparecen literalmente en las fuentes; las demás se corrigen o se quitan. Las gráficas verifican sus fuentes antes de insertarse. Si falta un criterio crítico de Google (firma, fuentes, titular o datos por confirmar), la nota no pasa de «Bueno» en el panel SEO.

**Buenas prácticas de redacción:** título de 15 a 65 caracteres; resumen de 70 a 155; 3 a 6 palabras clave; imagen con texto alternativo; firma y fuentes citadas; cifras con unidad, periodo y entidad; nada de afirmaciones sin fuente.

**Comprobaciones antes de enviar:** el título dice qué pasó; las cifras tienen fuente; las citas son literales; la sección es la correcta; la vista previa se ve bien en celular (el panel ofrece vista de escritorio y de teléfono).

# 7. Lista de artículos

*Artículos* permite filtrar por estado, sección, autor y orden. Por nota puedes abrirla, marcarla **Última hora** o **En vivo** (interruptores, solo editores), verla en el sitio o eliminarla. Marcar «Última hora» desde la lista **no** envía notificación push; el aviso sale al publicar. Un redactor solo ve y abre **sus** notas.

# 8. Consejo de redacción: planear la semana con IA

El **consejo de redacción** (menú *Consejo de redacción*) planea una semana completa: qué temas se cubren, en qué sección, con qué responsable y a qué hora sale cada pieza. Tiene **dos pestañas**: **Crear un consejo** y **Tareas del equipo**.

## 8.1 Crear un consejo (4 pasos)
1. **Semana.** Eliges la semana (cualquier día de ella), los **días** en que se publica, las **horas** (hora de Colombia) y con cuántas horas de antelación redacta la IA (para que un editor alcance a revisar).
2. **Temas.** Es el paso central: creas los temas **uno por uno** con «Nuevo tema». En cada formulario indicas:
   - **Sección** en que sale y **cómo sale**: con aprobación de un editor o automática (la automática solo está disponible para quien puede publicar y solo programa la nota si pasa el control de calidad: 300 palabras, fuentes y sin marcadores).
   - **Día** en que sale (por defecto, el primer día libre).
   - **¿Quién la escribe?** El responsable. La IA usa el estilo de escritura de esa persona.
   - Las **preguntas** del tema (hechos y cifras, audiencia, géneros, extensión, alcance, lugares, gráfica, tono, fuentes, qué evitar).
   - **Autollenar el resto con IA:** a partir de tu descripción del tema, la IA **investiga en la web** y llena esos campos con lo que encuentra (con su entidad y fecha). Tarda hasta un minuto y al final dice cuántas fuentes consultó. Revisa y corrige: lo que la IA no encuentra queda vacío, no inventado.
   Puedes crear **tantos temas como quieras**: si una sección ya no cabe a razón de sus notas por día, el sistema sube ese número solo. **Cada tema es una nota.**
3. **Parrilla.** El calendario con días y horas. La parrilla crea **una pieza por cada tema** que escribiste (una sección sin temas escritos conserva su cuota y la IA propone). Puedes **arrastrar** una pieza a otro día u hora, abrirla para cambiar tema, hora o cómo sale, y **Rearmar la parrilla con IA**. Al abrir una pieza ves su **ficha de pauta**: foco, por qué ahora, a quién le importa, qué aporta, fuentes, datos a confirmar, preguntas, género y extensión, riesgos, imagen y palabra clave. La IA no redacta sin ficha (no inventa): puedes completarla a mano o con **«Completar con investigación»**, y las que falten las completa el editor jefe con investigación al llegar la hora.
4. **Poner en marcha.** Resumen de piezas (con aprobación / automáticas), estado de las fichas y la casilla «Avisar al lector que la nota se elaboró con asistencia de IA» (recomendada). Al **activar**, la IA redacta cada pieza a su hora, con la antelación elegida; las que tienen aprobación quedan en *Para revisar*.

## 8.2 Tareas del equipo y Mis pendientes
- **Tareas del equipo** (pestaña del consejo): todas las piezas de los consejos activos o cerrados, con el editor a cargo, el estado (por redactar, redactando, para revisar, programada, publicada, con error), la hora y el enlace: **«Ver publicada»** si ya salió, **«Ver en desarrollo»** si va en el editor, o «Ver en el consejo». Se filtra por editor y por estado. La pestaña muestra el número de tareas abiertas.
- **Mis pendientes** (menú lateral): las piezas **asignadas a ti**. Un número rojo en el menú indica cuántas tienes y, mientras haya tareas nuevas que aún no abriste, aparece el aviso **«Te llegó una tarea nueva»** en cualquier pantalla del panel; se apaga al abrir *Mis pendientes* o al cerrarlo. El aviso funciona mientras tienes el panel abierto (no envía correo).

## 8.3 Escribir una tarea
En *Mis pendientes* pulsa **«Escribir esta nota»**. Se abre el asistente de 9 pasos (capítulo 6) con el **tema, el enfoque y las respuestas del consejo ya cargados** (hechos, lugares, fuentes, extensión, género, gráfica, qué evitar) y la sección elegida. Al poner un título la nota queda **enlazada a su tarea**: pasa a *Redactando*, la IA ya no la escribe sola, y al **enviarla a revisión** pasa a *Para revisar*. Si vuelves a abrir la tarea, te lleva a la nota que ya empezaste.

## 8.4 Qué pasa con lo que redacta la IA
La pieza redactada por la IA queda **en revisión** (o programada, si era automática y pasó el control). Aparece en «Esperando tu aprobación» del paso *Poner en marcha*. Un editor con permiso puede **aprobarla**: se programa para su hora, o sale ya si la hora pasó. Si la ficha no está completa, la pieza se detiene con un aviso (no se inventa).

# 9. Borradores de IA

*Borradores de IA* es la cola de lo que generan los agentes automáticos. Para cada borrador ves la fuente, el modelo y las **cifras verificadas o no**. **Aprobar** crea la nota en borrador firmada con tu ficha de autor; **Rechazar** exige un motivo. Nada se publica sin que un editor lo apruebe y lo publique. Los borradores de IA no cuentan como «tareas» ni como notas hasta que se aprueban.

# 10. Portada, plantillas y secciones (editores)

- **Portada y plantillas:** elige una de las **seis plantillas** (Esmeralda, Clásico, Revista, Compacto, Vanguardia y Gremial), pulsa una pieza de la página y ajusta fuente, tamaño y color; «Más opciones de texto» tiene grosor, mayúsculas, espaciado y degradado. Para una nota puedes fijar **dimensiones exactas en píxeles** de la foto (ancho y alto) y la posición del texto sobre la foto (arriba a la izquierda o a la derecha).
- **Flujo seguro:** los cambios quedan en **borrador**; ves una **vista previa real** y solo al pulsar **Publicar cambios** (con la lista de lo que cambia) salen al sitio. **Descartar** borra el borrador; **Deshacer la última publicación** vuelve al estado anterior.
- **Más leídas:** el bloque de «Más leídas» muestra las notas realmente más leídas de los últimos 7 días (no una selección manual).
- **Secciones:** el árbol de secciones y su orden en el menú (*Secciones*). Las secciones **TV, Radio y Especiales** tienen su propio formato (pantalla con videos, episodios con «Escuchar», y dossier).
- **Cintillo, publicidad y ventana emergente:** se editan desde la vista previa de la portada.

# 11. Newsletter (boletín)

**Newsletter** tiene ediciones y suscriptores (con mapa de Colombia). Para una **edición**:
1. **Contenido:** el «Armado» es una lista donde se mezclan **secciones** y notas. «Añadir sección» trae «Última hora» o cualquier sección con sus 3 notas más recientes.
2. **¿A quién va?:** el mapa de Colombia con una burbuja por ciudad (su tamaño es el número de suscriptores); pulsa una ciudad para elegirla o quitarla. También se filtra por tema de interés, país y antigüedad. Arriba verás cuántas personas la recibirían.
3. **Resumen con IA:** el botón «Redactar con IA» escribe un mensaje de apertura a partir de las notas elegidas (tú lo revisas y lo editas).
4. **Enviar o programar:** «Enviar ahora» o **Programar** para una fecha y hora de Colombia; mientras está programada no se edita («Cancelar programación» la devuelve a borrador). **Duplicar** crea una copia para otras ciudades u otra hora.
5. **Descargar PDF:** exporta la edición en una sola página.

**Importante:** el envío de correo requiere que un administrador conecte el proveedor de correo (Resend) y verifique el dominio remitente (CG-DOC-04). Sin eso, los envíos fallan con un aviso explícito. Los suscriptores se confirman por **doble confirmación**; un administrador puede **confirmar manualmente** a uno si hace falta.

# 12. Avisos, mensajes y asistente

- **Avisos:** franja o ventana emergente del sitio (solo con permiso).
- **Mensajes recibidos:** contacto y solicitudes de pauta; se responden fuera del panel.
- **Demanda del asistente:** qué le preguntan los lectores al asistente de IA; sirve para detectar temas.
- **El asistente público** responde solo con fuentes citables del archivo y del Observatorio; si no hay fuentes, **no responde**.

# 13. Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| No puedo entrar | 2FA sin activar, código vencido o cuenta desactivada | Revisa la hora del teléfono; pide a un administrador revisar la cuenta |
| No veo un menú | Falta el permiso | Pídelo a un administrador |
| La IA no responde o se demora | Límite de gasto o proveedor sin clave | Avisa a un administrador (Configuración → Asistente) |
| «Autollenar con IA» tarda | Investiga en la web | Espera hasta un minuto; si falla, vuelve a intentar |
| La nota no se guarda | Título de menos de 5 caracteres | Escribe el título; verás la hora del último guardado |
| Una pieza del consejo quedó «Falló» | Ficha incompleta o error del modelo | Abre la pieza, completa la ficha y reintenta |
| El boletín no sale | Proveedor de correo sin configurar, o la edición volvió a borrador por filtros vacíos | Pide al administrador revisar Resend; revisa «¿A quién va?» |
| Una nota programada no salió | El programador externo no está activo | Avisa al administrador (CG-DOC-06, R-07) |
| Mis pendientes no muestra una tarea | El consejo está en borrador, o la pieza no está asignada a ti | El consejo debe estar **activo**; revisa «¿Quién la escribe?» |

# 14. Glosario

**Pauta:** calendario de piezas de la semana. **Ficha de pauta:** las preguntas que se responden antes de redactar. **Pieza o casilla:** una nota prevista dentro de un consejo. **Tema:** idea de una nota con su sección, día y responsable. **Cobertura:** cuántas notas por día lleva una sección. **Responsable:** persona cuyo estilo usa la IA y a quien se asigna la tarea. **SEO:** lo que ve Google (título, descripción y palabras clave). **2FA:** segundo factor de autenticación. **Passkey:** llave de acceso del dispositivo. **Plantilla:** diseño completo del sitio.
