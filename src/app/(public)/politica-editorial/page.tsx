import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política editorial",
  description:
    "Cómo trabaja la redacción de CONtexto Ganadero: verificación, uso de asistentes de IA y atribución de autoría.",
};

export default function PoliticaEditorial() {
  return (
    <article className="prose">
      <h1>Política editorial</h1>
      <p>
        CONtexto Ganadero es un medio periodístico del sector ganadero y agropecuario colombiano.
        Esta página resume nuestras prácticas de verificación y el papel de las herramientas de
        inteligencia artificial en la producción de contenido.
      </p>
      <h2>Uso de asistentes de IA</h2>
      <p>
        Empleamos agentes de IA para redactar borradores a partir de fuentes estructuradas
        (boletines de precios, comunicados, convocatorias, agendas de ferias). Todo borrador pasa
        por un agente verificador que contrasta cada cifra contra su fuente y por la aprobación de
        un editor humano antes de publicarse. Ningún texto se publica de forma automática y el
        contenido publicado se atribuye siempre a un editor, no al sistema.
      </p>
      <h2>Asistente de consultas</h2>
      <p>
        Nuestro asistente conversacional responde únicamente con base en el archivo del medio y cita
        sus fuentes con enlace verificable. No ofrece asesoría veterinaria ni sanitaria para casos
        individuales.
      </p>
      <h2>Archivo histórico</h2>
      <p>
        Los artículos publicados antes de esta plataforma permanecen disponibles en sus direcciones
        originales, sin cambios.
      </p>
    </article>
  );
}
