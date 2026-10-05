import { notFound } from "next/navigation";

/**
 * Cualquier ruta inexistente bajo /en cae aquí para que el 404 salga con la
 * interfaz en inglés (el `not-found` hermano). Las redirecciones 301 del
 * archivo histórico solo existen en español, así que aquí no se consultan.
 */
export const dynamic = "force-dynamic";

// Rutas inglesas desconocidas: responde 404.
export default function EnglishCatchAll(): never {
  notFound();
}
