/**
 * Reglas de la biblioteca de imágenes, sin base de datos. Quien gestiona (administrador y quien tenga el permiso «biblioteca») ve todo;
 * el resto ve las carpetas que le asignaron y todo lo que hay dentro de ellas, hasta el fondo.
 */
export type CarpetaBase = { id: string; parentId: string | null; name: string };

/** Ids de las carpetas que la persona puede ver. */
export function carpetasVisibles(carpetas: CarpetaBase[], asignadas: string[], gestiona: boolean): Set<string> {
  if (gestiona) return new Set(carpetas.map((c) => c.id));
  const hijos = new Map<string | null, string[]>();
  for (const c of carpetas) hijos.set(c.parentId, [...(hijos.get(c.parentId) ?? []), c.id]);
  const visibles = new Set<string>();
  const pila = asignadas.filter((id) => carpetas.some((c) => c.id === id));
  while (pila.length) {
    const id = pila.pop()!;
    if (visibles.has(id)) continue;
    visibles.add(id);
    pila.push(...(hijos.get(id) ?? []));
  }
  return visibles;
}

/** La cadena de carpetas desde la raíz hasta `id` («redactores / Natalia»). Vacía si no existe. */
export function rutaDe(carpetas: CarpetaBase[], id: string | null): CarpetaBase[] {
  const porId = new Map(carpetas.map((c) => [c.id, c]));
  const ruta: CarpetaBase[] = [];
  const vistos = new Set<string>();
  for (let actual = id ? porId.get(id) : undefined; actual && !vistos.has(actual.id); actual = actual.parentId ? porId.get(actual.parentId) : undefined) {
    vistos.add(actual.id);
    ruta.unshift(actual);
  }
  return ruta;
}

/** ¿`id` es la carpeta `ancestro` o está dentro de ella? Sirve para no mover una carpeta dentro de sí misma. */
export function estaDentroDe(carpetas: CarpetaBase[], id: string, ancestro: string): boolean {
  return rutaDe(carpetas, id).some((c) => c.id === ancestro);
}

/** Nombre de carpeta o de archivo aceptable: sin barras, sin espacios sobrantes y con un largo razonable. `null` si no sirve. */
export function nombreValido(texto: unknown, max = 120): string | null {
  if (typeof texto !== "string") return null;
  const limpio = texto.replace(/[\\/\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return limpio && limpio.length <= max ? limpio : null;
}
