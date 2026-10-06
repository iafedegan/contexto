/**
 * Fachada del módulo de IA editorial: reexporta el contenido de src/lib/ai/*. El código se reparte por tarea
 * (borrador, opciones, gráfica, ideas y noticias, portada, entrevista…) para que cada pieza se pueda leer, probar y
 * cambiar por separado. Quien necesite IA importa de aquí; los archivos de src/lib/ai son internos del módulo.
 */
export * from "@/lib/ai/borrador";
export * from "@/lib/ai/entrevista";
export * from "@/lib/ai/grafica";
export * from "@/lib/ai/ideas-noticias";
export * from "@/lib/ai/investigacion";
export * from "@/lib/ai/opciones";
export * from "@/lib/ai/portada";
export * from "@/lib/ai/verificacion";
