/**
 * Ruta en español. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 *
 */
import type { Metadata } from "next";
import { makePage } from "../_pages/asistente";

export const metadata: Metadata = {
  title: "Asistente",
  description: "Asistente conversacional de CONtexto Ganadero: responde con base en el archivo completo del medio y cita cada fuente.",
};
export default makePage("es");
