# Consejo de redacción: cómo funciona en una sala de redacción real y cómo lo convertimos en software

Investigación (octubre de 2026) y su traducción a `/panel/consejo`. Lo que sigue distingue lo que dicen las fuentes de lo que es decisión de diseño nuestra.

---

## 1. Cómo funciona un consejo de redacción real

**Qué es.** El espacio donde un medio decide *qué publica y con qué enfoque* y, en el comité editorial, *qué postura toma*. Se reúnen director, editor general y editores de sección; a veces diseño y área comercial. En La Patria (Manizales) participa toda la sala "en igualdad de condiciones", incluidos practicantes, y quien preside **rota cada día** para que nadie monopolice la palabra; cualquiera propone un tema y los demás aportan al enfoque, al contexto, a los protagonistas y a las fuentes ([La Patria](https://www.lapatria.com/manizales/asi-funciona-el-consejo-de-redaccion-de-la-patria-el-lugar-donde-ocurre-la-magia)).

**Tres ritmos de reunión** ([24h dans une rédaction](https://24hdansuneredaction.com/en/presse/02-the-newsroom-meetings/); [estudio de medios online chilenos](https://www.researchgate.net/publication/277922298_El_trabajo_del_editor_y_la_pauta_en_medios_online_chilenos)):

| Ritmo | Para qué | Quién decide |
|---|---|---|
| **Diaria, corta** (de pie, ~20 min) | Organizar el día: cada sección presenta su "presupuesto" (lista de notas con autor, género, extensión e ilustración) y se ajusta la portada | El editor de sección decide su presupuesto; quien preside aprueba el general |
| **Semanal, larga** | Balance de la semana (qué faltó, cifras), y planificación de la siguiente | El consejo |
| **Comité editorial periódico** (trimestral/semestral) | Autocrítica, cobertura de temas futuros y postura del medio | Dirección / editor jefe |

Un día típico de un diario por secciones: 9:30 reunión de sección (cada periodista propone desde su agenda), 10:00 reunión operativa con representantes de todas las secciones, 17:30 cada periodista entrega su plan, 18:00 reunión provisional para la edición siguiente.

**El "presupuesto de historias" (story budget).** Es la lista viva de lo que se va a publicar: nota, responsable, género, extensión, ilustración, prioridad, fecha y hora de publicación y estado. Las redacciones modernas lo llevan en una herramienta compartida (hojas de cálculo o Airtable) con vistas por día, por semana y "lo que sale a las 6 a. m."; un registro por nota evita copiar y pegar y ahorró 6–8 horas semanales a una redacción ([RJI](https://rjionline.org/news/qa-what-a-newsroom-learned-switching-story-budgets-to-airtable/)).

**Cómo se decide qué entra.** Por valores noticiosos: actualidad, impacto, proximidad, prominencia, conflicto e interés humano; además, si llena un hueco de la cobertura del medio y si interesa a su audiencia ([Media Helping Media](https://mediahelpingmedia.org/basics/pitching-a-news-story-to-an-editor/)). Las piezas atemporales ("evergreen") sirven de colchón para días lentos; las de actualidad mandan en los días fuertes ([Wikipedia](https://en.wikipedia.org/wiki/Evergreen_(media))).

**Cierre del ciclo.** Se revisa lo publicado, se habla de los errores y se corrige; la reunión es también aprendizaje de la casa ([La Patria](https://www.lapatria.com/manizales/asi-funciona-el-consejo-de-redaccion-de-la-patria-el-lugar-donde-ocurre-la-magia)).

---

## 2. Qué debe estar respondido ANTES de que se haga una nota (la ficha de pauta)

Las fuentes no traen una "hoja de pauta" estándar; se reconstruye de varias prácticas:

- **Una frase de enfoque** ("alguien hace algo porque…"): quién, qué y por qué, antes de reportear; guía a quién entrevistar ([Transom](https://transom.org/2021/wrangling-stories-with-a-focus-sentence/), [Poynter](https://www.poynter.org/reporting-editing/2021/to-tell-stronger-stories-find-a-narrow-and-deep-focus/)).
- **Las seis preguntas de Poynter** ([Poynter](https://www.poynter.org/reporting-editing/2011/6-questions-that-can-help-journalists-find-a-focus-tell-better-stories/)): cómo se lo contarías a un amigo (¿por qué debería importarle?), titular provisional, qué sorprendió, **qué preguntas siguen sin respuesta**, qué aporta de nuevo (foto, gráfico) y qué enseñanza deja.
- **Por qué ahora y a quién le importa**: gancho de actualidad, original frente a lo ya publicado, personas afectadas y audiencia ([Media Helping Media](https://mediahelpingmedia.org/basics/pitching-a-news-story-to-an-editor/)).
- **Fuentes**: mínimo dos o tres principales, un temario de preguntas por fuente, y que queden identificadas en el cuerpo de la nota ([manual de estilo](https://fundaciongabo.org/sites/default/files/manual_de_estilo.pdf)).
- **Verificación antes de publicar** ([SPJ](https://www.spj.org/spj-code-of-ethics/)): verificar con fuentes originales, dar contexto, dar derecho de réplica a quien se acusa, justificar el anonimato, rotular opinión y análisis, y plan de corrección.
- **Riesgo legal y sensibilidad**: verificar cada afirmación y dar réplica en temas de riesgo ([RCFP](https://www.rcfp.org/resources/pre-publication-review-guide/)); cuidado con menores ([SPLC](https://splc.org/2020/01/naming-names-identifying-minors/)).
- **Género, extensión, imagen y fecha de entrega**: lo que cualquier "línea de presupuesto" lleva.

**Con IA** (AP, The Guardian, CBC): la IA puede ayudar en investigación y redacción, pero **toda salida la revisa una persona antes de publicar**, no reemplaza el reporteo ni la verificación y se debe **avisar al lector** cuando tuvo un papel material ([dig.watch sobre AP](https://dig.watch/updates/ap-ai-newsroom-rules), [CNTI](https://cnti.org/reports/newsroom-policies-for-ai-in-journalism-2/)).

### Las 13 preguntas de la ficha (en `src/lib/consejo/plan.ts`, `PREGUNTAS_FICHA`)

| # | Pregunta | Obligatoria | Origen |
|---|---|---|---|
| 1 | ¿De qué trata, en una frase? (foco) | **Sí** | Focus statement |
| 2 | ¿Por qué ahora? | **Sí** | Valor de actualidad |
| 3 | ¿A quién le importa y qué cambia para él? | **Sí** | Audiencia |
| 4 | ¿Qué aporta que no se haya publicado ya? | No | Poynter / hueco de cobertura |
| 5 | Fuentes previstas (voces y documentos, con enlace) | **Sí** | Manual de estilo |
| 6 | Datos que hay que confirmar | No | Verificación |
| 7 | Preguntas que la nota debe responder (≥ 2) | **Sí** | Poynter / 5W1H |
| 8 | Lo que aún no se sabe | No | Poynter ("preguntas sin respuesta") |
| 9 | Género y extensión | No | Línea de presupuesto |
| 10 | Riesgos y sensibilidad | No | SPJ / RCFP |
| 11 | Imagen o gráfica | No | Línea de presupuesto / Poynter |
| 12 | Palabra clave de enfoque | No | SEO |
| 13 | Vigencia (hoy / semana / atemporal) | No | Evergreen vs. actualidad |
| + | Lo que NO debe decir | No | Criterio editorial |

---

## 3. Cómo se convirtió en software

| Práctica de la sala de redacción | En la aplicación |
|---|---|
| Reunión semanal de planificación | Asistente de 5 pasos: Semana → Cobertura → Temas → Pauta → Poner en marcha |
| Presupuesto de historias con día, hora, sección y responsable | Parrilla (calendario) que construye el **código**, no el modelo: días × horas × cuotas por sección |
| Editor de sección decide su presupuesto | Cuota por sección (notas por día) y temas por sección, con cuántos faltan |
| Quién preside propone temas y todos aportan | Temas escritos por el equipo + sugerencias de la IA con fuentes, que se **añaden una a una** |
| El editor jefe reparte lo urgente temprano y lo atemporal después | `armarPautaCore`: prioriza, evita repetir hechos, mezcla local/internacional |
| Línea de presupuesto (género, extensión, ilustración, prioridad) | Casilla con prioridad, género, palabras, imagen y vigencia |
| Hoja de pauta / encargo | **Ficha de pauta** con las 13 preguntas; barra "Lista para redactar · N %" |
| "No se encarga sin enfoque, fuentes y preguntas" | **Compuerta**: sin los 5 datos obligatorios la IA no redacta (la pieza queda *detenida* y avisa) |
| El editor jefe prepara el encargo | "Completar con investigación": búsqueda con fuentes y enlaces; lo que no se halla va a "Lo que aún no se sabe" |
| Aprobación del editor antes de publicar | Casilla "con aprobación" (por defecto) → queda en revisión |
| Publicación automática | Opt-in por casilla; solo un editor con permiso; solo si la nota pasa el control (≥ 300 palabras, con fuentes, sin marcadores) |
| Transparencia con el lector | Aviso "Nota elaborada con asistencia de inteligencia artificial…" al final (activado por defecto) |
| Cierre del ciclo (revisar lo publicado) | Estados de cada pieza (planificada, redactando, revisión, programada, publicada, fallida) |

**Flujo de una pieza:** ficha lista (a mano, por la pauta de la IA o por investigación) → `antelación` antes de su hora se redacta con la tubería verificada (cifras y citas comprobadas por código) → revisión o programación → publicación → estado "publicada".

---

## 4. Lo que todavía falta (propuestas)

1. **Reunión de evaluación semanal**: tras cerrar la semana, resumen de lo publicado vs. planificado, lecturas por pieza y qué repetir (hoy hay estados, no balance).
2. **Memoria de cobertura**: antes de aceptar un tema, buscar si el sitio ya lo cubrió y mostrarlo ("¿qué aporta de nuevo?" se llenaría con datos reales).
3. **Derecho de réplica como tarea**: si la ficha marca "acusación", crear una tarea de contactar al aludido y no permitir publicación automática.
4. **Seguimientos**: una pieza publicada que genere una "segunda pieza" sugerida (las "preguntas abiertas" ya son la semilla).
5. **Rotación de quien preside** y registro de decisiones del consejo (acta).
6. **Calendario de agenda fija** (ferias, cifras que DANE/FEDEGAN publican, ciclos de vacunación) como entrada automática de temas.

---

### Fuentes

- La Patria — [Así funciona el consejo de redacción](https://www.lapatria.com/manizales/asi-funciona-el-consejo-de-redaccion-de-la-patria-el-lugar-donde-ocurre-la-magia)
- 24h dans une rédaction — [The newsroom meetings](https://24hdansuneredaction.com/en/presse/02-the-newsroom-meetings/)
- RJI — [Story budgets en Airtable](https://rjionline.org/news/qa-what-a-newsroom-learned-switching-story-budgets-to-airtable/)
- Media Helping Media — [Pitching a news story to an editor](https://mediahelpingmedia.org/basics/pitching-a-news-story-to-an-editor/)
- Poynter — [6 questions that can help journalists find a focus](https://www.poynter.org/reporting-editing/2011/6-questions-that-can-help-journalists-find-a-focus-tell-better-stories/) y [narrow and deep focus](https://www.poynter.org/reporting-editing/2021/to-tell-stronger-stories-find-a-narrow-and-deep-focus/)
- Transom — [Wrangling stories with a focus sentence](https://transom.org/2021/wrangling-stories-with-a-focus-sentence/)
- SPJ — [Code of Ethics](https://www.spj.org/spj-code-of-ethics/)
- RCFP — [Pre-publication review guide](https://www.rcfp.org/resources/pre-publication-review-guide/)
- Fundación Gabo — [Manual de estilo](https://fundaciongabo.org/sites/default/files/manual_de_estilo.pdf)
- AP y otras redacciones sobre IA — [dig.watch](https://dig.watch/updates/ap-ai-newsroom-rules), [CNTI](https://cnti.org/reports/newsroom-policies-for-ai-in-journalism-2/)
- El trabajo del editor y la pauta en medios online chilenos — [ResearchGate](https://www.researchgate.net/publication/277922298_El_trabajo_del_editor_y_la_pauta_en_medios_online_chilenos)
