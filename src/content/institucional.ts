/**
 * Páginas institucionales del menú secundario (§2.2 del anexo funcional).
 *
 * El contenido vive aquí y no en la base de datos a propósito: son documentos
 * estables, versionados con el código y revisables en un pull request, que es
 * justo lo que se espera de un texto legal. Si más adelante la redacción quiere
 * editarlos sin despliegue, el paso natural es moverlos a `site_settings`.
 *
 * AVISO: los textos legales son una base funcional completa, pero deben pasar
 * por revisión del área jurídica de FEDEGÁN antes de salir a producción.
 */

import type { Locale } from "@/lib/i18n";

export type Bloque =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; items: string[] }
  | { tipo: "datos"; items: { etiqueta: string; valor: string; href?: string }[] };

export type Seccion = { id: string; titulo: string; bloques: Bloque[] };

export type DocumentoInstitucional = {
  slug: string;
  /** Formulario que se inserta al final, si aplica. */
  formulario?: "contacto" | "comercial";
  titulo: Record<Locale, string>;
  bajada: Record<Locale, string>;
  descripcion: Record<Locale, string>;
  secciones: Record<Locale, Seccion[]>;
};

const ACTUALIZADO = "22 de septiembre de 2026";

export const DOCUMENTOS: DocumentoInstitucional[] = [
  // ------------------------------------------------------------- Contacto
  {
    slug: "contacto",
    formulario: "contacto",
    titulo: { es: "Contacto", en: "Contact" },
    bajada: {
      es: "Escríbenos: la redacción responde en días hábiles.",
      en: "Write to us: the newsroom replies on business days.",
    },
    descripcion: {
      es: "Canales de contacto de CONtexto Ganadero: redacción, corrección de contenidos, pauta y atención institucional.",
      en: "Contact channels for CONtexto Ganadero: newsroom, corrections, advertising and institutional enquiries.",
    },
    secciones: {
      es: [
        {
          id: "canales",
          titulo: "Canales directos",
          bloques: [
            {
              tipo: "datos",
              items: [
                { etiqueta: "Redacción", valor: "contexto@fedegan.org.co", href: "mailto:contexto@fedegan.org.co" },
                { etiqueta: "Pauta y comercial", valor: "pauta@fedegan.org.co", href: "mailto:pauta@fedegan.org.co" },
                { etiqueta: "Teléfono", valor: "(+57 601) 578 2020", href: "tel:+576015782020" },
                { etiqueta: "Dirección", valor: "Calle 37 n.º 14-31, Bogotá D. C., Colombia" },
              ],
            },
          ],
        },
        {
          id: "correcciones",
          titulo: "Correcciones y derecho de réplica",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Si detectas un error en una publicación, escríbenos indicando el enlace de la nota y el dato que consideras equivocado. Verificamos todas las solicitudes; cuando el error se confirma, se corrige y se deja constancia visible de la corrección en la propia nota.",
            },
            {
              tipo: "parrafo",
              texto:
                "Las personas o entidades aludidas en una publicación pueden ejercer su derecho de réplica por este mismo canal.",
            },
          ],
        },
      ],
      en: [
        {
          id: "canales",
          titulo: "Direct channels",
          bloques: [
            {
              tipo: "datos",
              items: [
                { etiqueta: "Newsroom", valor: "contexto@fedegan.org.co", href: "mailto:contexto@fedegan.org.co" },
                { etiqueta: "Advertising", valor: "pauta@fedegan.org.co", href: "mailto:pauta@fedegan.org.co" },
                { etiqueta: "Phone", valor: "(+57 601) 578 2020", href: "tel:+576015782020" },
                { etiqueta: "Address", valor: "Calle 37 n.º 14-31, Bogotá D. C., Colombia" },
              ],
            },
          ],
        },
        {
          id: "correcciones",
          titulo: "Corrections and right of reply",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "If you spot an error, write to us with the link to the story and the disputed fact. We check every request; confirmed errors are corrected and the correction is recorded visibly on the story itself.",
            },
            {
              tipo: "parrafo",
              texto:
                "People or organisations named in a story may exercise their right of reply through this same channel.",
            },
          ],
        },
      ],
    },
  },

  // -------------------------------------------------------- Quiénes somos
  {
    slug: "quienes-somos",
    titulo: { es: "Quiénes somos", en: "About us" },
    bajada: {
      es: "El medio digital especializado del sector ganadero colombiano.",
      en: "Colombia's specialist digital outlet for the cattle sector.",
    },
    descripcion: {
      es: "CONtexto Ganadero es el medio digital de FEDEGÁN especializado en el sector ganadero y agropecuario colombiano.",
      en: "CONtexto Ganadero is FEDEGÁN's digital outlet specialising in Colombia's cattle and agricultural sector.",
    },
    secciones: {
      es: [
        {
          id: "mision",
          titulo: "Qué hacemos",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "CONtexto Ganadero es el medio digital especializado del sector ganadero colombiano, un activo editorial del Fondo Nacional del Ganado administrado por FEDEGÁN. Publicamos noticias, análisis y datos sobre mercados, regiones, sostenibilidad, sanidad animal, ciencia, tecnología y política gremial.",
            },
            {
              tipo: "parrafo",
              texto:
                "Nuestro público son productores, técnicos, gremios, autoridades, investigadores y periodistas que necesitan información verificada del sector para tomar decisiones.",
            },
          ],
        },
        {
          id: "principios",
          titulo: "Cómo trabajamos",
          bloques: [
            {
              tipo: "lista",
              items: [
                "Toda la información publicada está atribuida a una fuente identificable y verificable.",
                "Separamos con claridad la información de la opinión y del contenido comercial.",
                "Los contenidos generados con asistencia de inteligencia artificial se revisan y aprueban siempre por un editor humano antes de publicarse.",
                "Corregimos los errores de forma visible, sin borrar el registro de lo publicado.",
              ],
            },
            {
              tipo: "parrafo",
              texto:
                "El detalle de estos compromisos está en nuestra política editorial.",
            },
          ],
        },
        {
          id: "archivo",
          titulo: "El archivo",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "CONtexto Ganadero conserva un archivo de más de cuarenta mil publicaciones. El archivo histórico es de solo lectura y mantiene sus direcciones originales para no romper enlaces ni citas académicas.",
            },
          ],
        },
      ],
      en: [
        {
          id: "mision",
          titulo: "What we do",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "CONtexto Ganadero is Colombia's specialist digital outlet for the cattle sector, an editorial asset of the Fondo Nacional del Ganado managed by FEDEGÁN. We publish news, analysis and data on markets, regions, sustainability, animal health, science, technology and industry policy.",
            },
            {
              tipo: "parrafo",
              texto:
                "Our readers are producers, technicians, trade bodies, authorities, researchers and journalists who need verified sector information to make decisions.",
            },
          ],
        },
        {
          id: "principios",
          titulo: "How we work",
          bloques: [
            {
              tipo: "lista",
              items: [
                "Every published fact is attributed to an identifiable, verifiable source.",
                "We clearly separate news, opinion and commercial content.",
                "AI-assisted content is always reviewed and approved by a human editor before publication.",
                "We correct mistakes visibly, without erasing the record of what was published.",
              ],
            },
            { tipo: "parrafo", texto: "These commitments are detailed in our editorial policy." },
          ],
        },
        {
          id: "archivo",
          titulo: "The archive",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "CONtexto Ganadero keeps an archive of more than forty thousand publications. The historical archive is read-only and keeps its original addresses so links and academic citations never break.",
            },
          ],
        },
      ],
    },
  },

  // ------------------------------------------------- Preguntas frecuentes
  {
    slug: "preguntas-frecuentes",
    titulo: { es: "Preguntas frecuentes", en: "Frequently asked questions" },
    bajada: {
      es: "Dudas habituales sobre el portal, los contenidos y su reutilización.",
      en: "Common questions about the site, its content and its reuse.",
    },
    descripcion: {
      es: "Respuestas a las dudas más frecuentes sobre CONtexto Ganadero: suscripción, uso de contenidos, archivo histórico y publicidad.",
      en: "Answers to the most frequent questions about CONtexto Ganadero: newsletter, content reuse, archive and advertising.",
    },
    secciones: {
      es: [
        {
          id: "acceso",
          titulo: "¿El contenido es gratuito?",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Sí. Todo el contenido periodístico de CONtexto Ganadero es de acceso libre y no requiere suscripción ni registro.",
            },
          ],
        },
        {
          id: "boletin",
          titulo: "¿Cómo recibo las noticias por correo?",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Puedes suscribirte al boletín desde el formulario que aparece en la portada y en la barra lateral. Recibirás un correo de confirmación y podrás darte de baja en cualquier momento desde el enlace que incluye cada envío.",
            },
          ],
        },
        {
          id: "reutilizacion",
          titulo: "¿Puedo reproducir un artículo?",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Se permite citar fragmentos breves con atribución expresa a CONtexto Ganadero y enlace a la publicación original. La reproducción total requiere autorización previa por escrito; escríbenos a contexto@fedegan.org.co.",
            },
          ],
        },
        {
          id: "archivo",
          titulo: "No encuentro una nota antigua",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "El archivo histórico conserva sus direcciones originales. Usa el buscador del portal: los resultados incluyen tanto las publicaciones nuevas como las del archivo, señaladas con la etiqueta «archivo».",
            },
          ],
        },
        {
          id: "pauta",
          titulo: "¿Cómo anuncio en el portal?",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "En la página «Paute con nosotros» encontrarás los formatos disponibles y el formulario para solicitar la tarifa comercial vigente.",
            },
          ],
        },
        {
          id: "ia",
          titulo: "¿Usan inteligencia artificial?",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Sí, como herramienta de apoyo a la redacción y para el asistente de consultas del archivo. Ningún contenido generado por un modelo se publica sin la revisión y aprobación explícita de un editor, y el asistente solo responde citando fuentes del propio portal.",
            },
          ],
        },
      ],
      en: [
        {
          id: "acceso",
          titulo: "Is the content free?",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Yes. All journalistic content on CONtexto Ganadero is freely accessible and requires no subscription or registration.",
            },
          ],
        },
        {
          id: "boletin",
          titulo: "How do I get the news by email?",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "You can subscribe to the newsletter from the form on the home page and in the sidebar. You will get a confirmation email and can unsubscribe at any time from the link in every issue.",
            },
          ],
        },
        {
          id: "reutilizacion",
          titulo: "May I republish an article?",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Short quotations are allowed with explicit attribution to CONtexto Ganadero and a link to the original. Full republication requires prior written permission: write to contexto@fedegan.org.co.",
            },
          ],
        },
        {
          id: "archivo",
          titulo: "I cannot find an old story",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "The historical archive keeps its original addresses. Use the site search: results include both new publications and archive items, marked with an «archivo» tag.",
            },
          ],
        },
        {
          id: "pauta",
          titulo: "How do I advertise?",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "The «Advertise with us» page lists the available formats and the form to request the current rate card.",
            },
          ],
        },
        {
          id: "ia",
          titulo: "Do you use artificial intelligence?",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Yes, as a drafting aid and for the archive assistant. No model-generated content is published without explicit review and approval by an editor, and the assistant only answers by citing sources from the site itself.",
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------- Paute con nosotros
  {
    slug: "paute-con-nosotros",
    formulario: "comercial",
    titulo: { es: "Paute con nosotros", en: "Advertise with us" },
    bajada: {
      es: "Llega a la audiencia especializada del sector ganadero colombiano.",
      en: "Reach Colombia's specialist cattle-sector audience.",
    },
    descripcion: {
      es: "Formatos publicitarios, audiencia y contacto comercial de CONtexto Ganadero.",
      en: "Advertising formats, audience and commercial contact for CONtexto Ganadero.",
    },
    secciones: {
      es: [
        {
          id: "audiencia",
          titulo: "La audiencia",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "CONtexto Ganadero reúne a productores, técnicos, comercializadores, gremios, entidades públicas y academia del sector agropecuario colombiano. Es un público profesional que consulta el portal para tomar decisiones de producción y de mercado.",
            },
          ],
        },
        {
          id: "formatos",
          titulo: "Formatos disponibles",
          bloques: [
            {
              tipo: "lista",
              items: [
                "Leaderboard 728 × 90 — cabecera, debajo del menú principal.",
                "Billboard 970 × 250 — bajo la noticia destacada de portada.",
                "Medium Rectangle 300 × 250 — dentro de la grilla de noticias y en la parte superior de la barra lateral.",
                "Half Page 300 × 600 — barra lateral, con comportamiento fijo durante el scroll.",
                "Leaderboard 728 × 90 — pie de página.",
                "Contenido patrocinado — nota editorial identificada como tal, sujeta a aprobación de la dirección editorial.",
              ],
            },
          ],
        },
        {
          id: "criterios",
          titulo: "Criterios editoriales",
          bloques: [
            {
              tipo: "lista",
              items: [
                "Toda pieza comercial se etiqueta visiblemente como «Publicidad».",
                "El contenido patrocinado se identifica siempre y nunca se confunde con la información periodística.",
                "La dirección editorial se reserva el derecho de rechazar piezas que induzcan a error o afecten la credibilidad del medio.",
                "No se aceptan formatos intrusivos que interrumpan la lectura ni que comprometan el rendimiento del portal.",
              ],
            },
          ],
        },
      ],
      en: [
        {
          id: "audiencia",
          titulo: "The audience",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "CONtexto Ganadero brings together producers, technicians, traders, trade bodies, public agencies and academia from Colombia's agricultural sector — a professional readership that consults the site to make production and market decisions.",
            },
          ],
        },
        {
          id: "formatos",
          titulo: "Available formats",
          bloques: [
            {
              tipo: "lista",
              items: [
                "Leaderboard 728 × 90 — header, below the main menu.",
                "Billboard 970 × 250 — under the lead story on the home page.",
                "Medium Rectangle 300 × 250 — inside the news grid and at the top of the sidebar.",
                "Half Page 300 × 600 — sidebar, sticky while scrolling.",
                "Leaderboard 728 × 90 — footer.",
                "Sponsored content — an editorial piece labelled as such, subject to editorial approval.",
              ],
            },
          ],
        },
        {
          id: "criterios",
          titulo: "Editorial criteria",
          bloques: [
            {
              tipo: "lista",
              items: [
                "Every commercial placement is visibly labelled as advertising.",
                "Sponsored content is always identified and never mistaken for journalism.",
                "The editorial board may reject misleading placements or any that damage the outlet's credibility.",
                "Intrusive formats that interrupt reading or harm site performance are not accepted.",
              ],
            },
          ],
        },
      ],
    },
  },

  // ------------------------------------------------ Términos y condiciones
  {
    slug: "terminos-y-condiciones",
    titulo: { es: "Términos y condiciones de uso", en: "Terms of use" },
    bajada: {
      es: "Condiciones que rigen el acceso y el uso del portal.",
      en: "Conditions governing access to and use of this site.",
    },
    descripcion: {
      es: "Términos y condiciones de uso del portal CONtexto Ganadero.",
      en: "Terms and conditions of use for the CONtexto Ganadero website.",
    },
    secciones: {
      es: [
        {
          id: "objeto",
          titulo: "1. Objeto y aceptación",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Estos términos regulan el acceso y uso del portal CONtexto Ganadero, activo digital del Fondo Nacional del Ganado administrado por la Federación Colombiana de Ganaderos (FEDEGÁN). El acceso al portal implica la aceptación plena de estas condiciones.",
            },
          ],
        },
        {
          id: "uso",
          titulo: "2. Uso permitido",
          bloques: [
            {
              tipo: "lista",
              items: [
                "El contenido puede consultarse, compartirse y citarse con fines informativos, académicos o profesionales, siempre con atribución y enlace a la fuente original.",
                "No se permite el uso del portal para fines ilícitos, ni la extracción masiva y automatizada de contenidos sin autorización expresa.",
                "No se permite alterar, suprimir ni eludir los avisos de autoría, marca o protección técnica del portal.",
              ],
            },
          ],
        },
        {
          id: "responsabilidad",
          titulo: "3. Responsabilidad",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "La información publicada tiene carácter informativo y no constituye asesoría técnica, veterinaria, jurídica ni financiera. Las decisiones que el lector adopte con base en ella son de su exclusiva responsabilidad.",
            },
            {
              tipo: "parrafo",
              texto:
                "El portal enlaza a sitios de terceros sobre cuyos contenidos no ejerce control; su inclusión no implica respaldo.",
            },
          ],
        },
        {
          id: "opinion",
          titulo: "4. Columnas de opinión",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Las opiniones publicadas en la sección de opinión son responsabilidad de sus autores y no representan necesariamente la posición institucional de FEDEGÁN ni de CONtexto Ganadero.",
            },
          ],
        },
        {
          id: "modificaciones",
          titulo: "5. Modificaciones y ley aplicable",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                `Estos términos pueden actualizarse; la versión vigente es la publicada en esta página. Última actualización: ${ACTUALIZADO}. Se rigen por la legislación de la República de Colombia.`,
            },
          ],
        },
      ],
      en: [
        {
          id: "objeto",
          titulo: "1. Purpose and acceptance",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "These terms govern access to and use of CONtexto Ganadero, a digital asset of the Fondo Nacional del Ganado managed by the Colombian Cattle Farmers' Federation (FEDEGÁN). Accessing the site implies full acceptance of these conditions.",
            },
          ],
        },
        {
          id: "uso",
          titulo: "2. Permitted use",
          bloques: [
            {
              tipo: "lista",
              items: [
                "Content may be read, shared and quoted for informational, academic or professional purposes, always with attribution and a link to the original source.",
                "The site may not be used for unlawful purposes, nor may content be scraped in bulk without express permission.",
                "Authorship notices, trademarks and technical protection measures may not be altered, removed or circumvented.",
              ],
            },
          ],
        },
        {
          id: "responsabilidad",
          titulo: "3. Liability",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Published information is informational and does not constitute technical, veterinary, legal or financial advice. Decisions taken on its basis are the reader's sole responsibility.",
            },
            {
              tipo: "parrafo",
              texto:
                "The site links to third-party pages over whose content it has no control; their inclusion does not imply endorsement.",
            },
          ],
        },
        {
          id: "opinion",
          titulo: "4. Opinion columns",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Opinions published in the opinion section are their authors' responsibility and do not necessarily reflect the institutional position of FEDEGÁN or CONtexto Ganadero.",
            },
          ],
        },
        {
          id: "modificaciones",
          titulo: "5. Changes and governing law",
          bloques: [
            {
              tipo: "parrafo",
              texto: `These terms may be updated; the version in force is the one published on this page. Last updated: ${ACTUALIZADO}. They are governed by the laws of the Republic of Colombia.`,
            },
          ],
        },
      ],
    },
  },

  // ------------------------------------------------- Política de privacidad
  {
    slug: "politica-de-privacidad",
    titulo: { es: "Política de privacidad", en: "Privacy policy" },
    bajada: {
      es: "Qué datos tratamos, para qué y cómo ejercer tus derechos.",
      en: "What data we process, why, and how to exercise your rights.",
    },
    descripcion: {
      es: "Política de tratamiento de datos personales de CONtexto Ganadero, conforme a la Ley 1581 de 2012.",
      en: "Personal data policy for CONtexto Ganadero under Colombian Law 1581 of 2012.",
    },
    secciones: {
      es: [
        {
          id: "responsable",
          titulo: "1. Responsable del tratamiento",
          bloques: [
            {
              tipo: "datos",
              items: [
                { etiqueta: "Responsable", valor: "Federación Colombiana de Ganaderos (FEDEGÁN)" },
                { etiqueta: "Dirección", valor: "Calle 37 n.º 14-31, Bogotá D. C., Colombia" },
                { etiqueta: "Correo de habeas data", valor: "habeasdata@fedegan.org.co", href: "mailto:habeasdata@fedegan.org.co" },
              ],
            },
          ],
        },
        {
          id: "datos",
          titulo: "2. Datos que tratamos",
          bloques: [
            {
              tipo: "lista",
              items: [
                "Boletín: correo electrónico y, opcionalmente, nombre, con la única finalidad de enviar el boletín informativo.",
                "Formularios de contacto y comerciales: nombre, correo, organización y el mensaje que decidas enviarnos.",
                "Navegación: datos de uso agregados y seudonimizados con fines estadísticos y de mejora del portal.",
              ],
            },
            {
              tipo: "parrafo",
              texto:
                "No recogemos datos sensibles ni construimos perfiles individuales con fines publicitarios.",
            },
          ],
        },
        {
          id: "finalidad",
          titulo: "3. Finalidad y conservación",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Los datos se tratan únicamente para las finalidades indicadas al recogerlos y se conservan mientras dure la relación o hasta que solicites su supresión. Los datos del boletín se eliminan al darte de baja.",
            },
          ],
        },
        {
          id: "derechos",
          titulo: "4. Tus derechos",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013, puedes conocer, actualizar, rectificar y suprimir tus datos, así como revocar la autorización otorgada. Para ejercerlos, escribe a habeasdata@fedegan.org.co indicando tu solicitud; responderemos en los plazos legales.",
            },
          ],
        },
        {
          id: "terceros",
          titulo: "5. Encargados y transferencias",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Utilizamos proveedores tecnológicos para alojamiento, envío de correo y analítica, que actúan como encargados del tratamiento bajo contrato y solo conforme a nuestras instrucciones.",
            },
          ],
        },
      ],
      en: [
        {
          id: "responsable",
          titulo: "1. Data controller",
          bloques: [
            {
              tipo: "datos",
              items: [
                { etiqueta: "Controller", valor: "Federación Colombiana de Ganaderos (FEDEGÁN)" },
                { etiqueta: "Address", valor: "Calle 37 n.º 14-31, Bogotá D. C., Colombia" },
                { etiqueta: "Data protection contact", valor: "habeasdata@fedegan.org.co", href: "mailto:habeasdata@fedegan.org.co" },
              ],
            },
          ],
        },
        {
          id: "datos",
          titulo: "2. Data we process",
          bloques: [
            {
              tipo: "lista",
              items: [
                "Newsletter: email address and, optionally, name, solely to send the newsletter.",
                "Contact and commercial forms: name, email, organisation and the message you choose to send.",
                "Browsing: aggregated, pseudonymised usage data for statistics and site improvement.",
              ],
            },
            {
              tipo: "parrafo",
              texto: "We do not collect sensitive data or build individual profiles for advertising.",
            },
          ],
        },
        {
          id: "finalidad",
          titulo: "3. Purpose and retention",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Data is processed only for the purposes stated when collected and kept for as long as the relationship lasts or until you ask for deletion. Newsletter data is deleted when you unsubscribe.",
            },
          ],
        },
        {
          id: "derechos",
          titulo: "4. Your rights",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Under Colombian Law 1581 of 2012 and Decree 1377 of 2013 you may access, update, rectify and delete your data, and withdraw consent. Write to habeasdata@fedegan.org.co; we reply within the legal deadlines.",
            },
          ],
        },
        {
          id: "terceros",
          titulo: "5. Processors and transfers",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "We use technology providers for hosting, email delivery and analytics; they act as processors under contract and only on our instructions.",
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------- Política de cookies
  {
    slug: "politica-de-cookies",
    titulo: { es: "Política de cookies", en: "Cookie policy" },
    bajada: {
      es: "Qué cookies usamos y cómo controlarlas.",
      en: "Which cookies we use and how to control them.",
    },
    descripcion: {
      es: "Tipos de cookies utilizadas en CONtexto Ganadero y cómo gestionarlas.",
      en: "Cookie types used on CONtexto Ganadero and how to manage them.",
    },
    secciones: {
      es: [
        {
          id: "que-son",
          titulo: "1. Qué son",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Las cookies son pequeños archivos que un sitio guarda en tu navegador para recordar información entre visitas. Este portal usa el mínimo imprescindible.",
            },
          ],
        },
        {
          id: "tipos",
          titulo: "2. Cookies que utilizamos",
          bloques: [
            {
              tipo: "lista",
              items: [
                "Técnicas o necesarias: mantienen la sesión del panel editorial y tus preferencias de interfaz, como el idioma o el modo oscuro. No requieren consentimiento.",
                "Analíticas: miden de forma agregada qué contenidos se leen, para orientar decisiones editoriales. Solo se activan si las aceptas.",
                "Publicitarias: si una campaña las requiere, se informará y solo se cargarán con tu consentimiento.",
              ],
            },
          ],
        },
        {
          id: "control",
          titulo: "3. Cómo controlarlas",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Puedes cambiar tu decisión en cualquier momento desde el aviso de cookies del portal, y borrar o bloquear cookies desde la configuración de tu navegador. Bloquear las técnicas puede impedir el uso del panel editorial.",
            },
          ],
        },
      ],
      en: [
        {
          id: "que-son",
          titulo: "1. What they are",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Cookies are small files a site stores in your browser to remember information between visits. This site uses the bare minimum.",
            },
          ],
        },
        {
          id: "tipos",
          titulo: "2. Cookies we use",
          bloques: [
            {
              tipo: "lista",
              items: [
                "Necessary: keep the editorial panel session and interface preferences such as language or dark mode. No consent required.",
                "Analytics: measure in aggregate which content is read, to guide editorial decisions. Only enabled if you accept.",
                "Advertising: if a campaign requires them, this will be stated and they will load only with your consent.",
              ],
            },
          ],
        },
        {
          id: "control",
          titulo: "3. How to control them",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "You can change your choice at any time from the site's cookie notice, and delete or block cookies in your browser settings. Blocking necessary cookies may prevent use of the editorial panel.",
            },
          ],
        },
      ],
    },
  },

  // --------------------------------------- Derechos de autor y propiedad
  {
    slug: "derechos-de-autor",
    titulo: {
      es: "Derechos de autor y propiedad intelectual",
      en: "Copyright and intellectual property",
    },
    bajada: {
      es: "Titularidad de los contenidos y condiciones de reutilización.",
      en: "Ownership of content and conditions for reuse.",
    },
    descripcion: {
      es: "Política de derechos de autor y propiedad intelectual de CONtexto Ganadero.",
      en: "Copyright and intellectual property policy for CONtexto Ganadero.",
    },
    secciones: {
      es: [
        {
          id: "titularidad",
          titulo: "1. Titularidad",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Los contenidos publicados en CONtexto Ganadero —textos, fotografías, vídeos, audios, infografías, bases de datos y elementos de diseño— están protegidos por la Ley 23 de 1982 y demás normas sobre derecho de autor, y son titularidad del Fondo Nacional del Ganado o de sus respectivos autores y licenciantes.",
            },
          ],
        },
        {
          id: "usos",
          titulo: "2. Usos permitidos",
          bloques: [
            {
              tipo: "lista",
              items: [
                "Cita de fragmentos breves con atribución expresa a CONtexto Ganadero y enlace a la publicación original.",
                "Uso personal, académico o de investigación, sin explotación comercial.",
                "Enlace directo a cualquier publicación, sin necesidad de autorización previa.",
              ],
            },
          ],
        },
        {
          id: "prohibidos",
          titulo: "3. Usos que requieren autorización",
          bloques: [
            {
              tipo: "lista",
              items: [
                "Reproducción total o sustancial de un artículo en otro medio, impreso o digital.",
                "Uso comercial de fotografías, vídeos o infografías.",
                "Extracción sistemática del archivo o de la base de datos, incluido el entrenamiento de modelos, salvo acuerdo expreso.",
              ],
            },
            {
              tipo: "parrafo",
              texto: "Las solicitudes se tramitan en contexto@fedegan.org.co.",
            },
          ],
        },
        {
          id: "reclamaciones",
          titulo: "4. Reclamaciones",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Si consideras que un contenido publicado vulnera tus derechos, escríbenos identificando la obra, el enlace y la titularidad que alegas. Revisaremos la solicitud y, de ser procedente, retiraremos o corregiremos el contenido.",
            },
          ],
        },
      ],
      en: [
        {
          id: "titularidad",
          titulo: "1. Ownership",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "Content published on CONtexto Ganadero — text, photographs, video, audio, infographics, databases and design elements — is protected by Colombian Law 23 of 1982 and other copyright rules, and is owned by the Fondo Nacional del Ganado or its respective authors and licensors.",
            },
          ],
        },
        {
          id: "usos",
          titulo: "2. Permitted uses",
          bloques: [
            {
              tipo: "lista",
              items: [
                "Short quotations with explicit attribution to CONtexto Ganadero and a link to the original.",
                "Personal, academic or research use, without commercial exploitation.",
                "Direct linking to any publication, with no prior permission needed.",
              ],
            },
          ],
        },
        {
          id: "prohibidos",
          titulo: "3. Uses requiring permission",
          bloques: [
            {
              tipo: "lista",
              items: [
                "Full or substantial reproduction of an article in another outlet, printed or digital.",
                "Commercial use of photographs, video or infographics.",
                "Systematic extraction of the archive or database, including model training, unless expressly agreed.",
              ],
            },
            { tipo: "parrafo", texto: "Requests are handled at contexto@fedegan.org.co." },
          ],
        },
        {
          id: "reclamaciones",
          titulo: "4. Claims",
          bloques: [
            {
              tipo: "parrafo",
              texto:
                "If you believe published content infringes your rights, write to us identifying the work, the link and the ownership you claim. We will review the request and, where appropriate, remove or correct the content.",
            },
          ],
        },
      ],
    },
  },
];

export const DOC_SLUGS = DOCUMENTOS.map((d) => d.slug);

export function documento(slug: string): DocumentoInstitucional | undefined {
  return DOCUMENTOS.find((d) => d.slug === slug);
}

/** Menú secundario del §2.2, en el orden del anexo funcional. */
export const MENU_SECUNDARIO: { slug: string; label: Record<Locale, string> }[] = [
  { slug: "contacto", label: { es: "Contacto", en: "Contact" } },
  { slug: "quienes-somos", label: { es: "Quiénes somos", en: "About us" } },
  { slug: "preguntas-frecuentes", label: { es: "Preguntas frecuentes", en: "FAQ" } },
  { slug: "paute-con-nosotros", label: { es: "Paute con nosotros", en: "Advertise with us" } },
  { slug: "terminos-y-condiciones", label: { es: "Términos y condiciones", en: "Terms of use" } },
  { slug: "politica-de-privacidad", label: { es: "Política de privacidad", en: "Privacy policy" } },
  { slug: "politica-de-cookies", label: { es: "Política de cookies", en: "Cookie policy" } },
  { slug: "politica-editorial", label: { es: "Política editorial", en: "Editorial policy" } },
  { slug: "derechos-de-autor", label: { es: "Derechos de autor", en: "Copyright" } },
];
