import type { UserRole } from "@/db/schema";

/**
 * Permisos por persona. Cada rol trae unos por defecto y un administrador
 * puede encender o apagar casillas por persona (un redactor al que se le
 * confía el newsletter, un editor al que se le quita publicar…).
 *
 * Lo que NO es una casilla, a propósito: cambiar roles, crear y eliminar
 * cuentas. Si fuera delegable, un editor con ese permiso podría ascenderse a
 * administrador. Eso, y los ajustes del sitio, siguen siendo del administrador,
 * que siempre tiene todos los permisos y no se puede restringir.
 */

export const RANGO: Record<UserRole, number> = { redactor: 1, disenador: 1, editor: 2, administrador: 3 };

// Roles que se pueden asignar a una cuenta, de menor a mayor.
export const ROLES: UserRole[] = ["redactor", "disenador", "editor", "administrador"];

// Catálogo de permisos con el rol mínimo que los tiene por defecto.
export const PERMISOS = [
  { id: "articulos", label: "Redactar artículos", hint: "Crear y editar artículos y mandarlos a revisión", min: "redactor", grupo: "Redactor" },
  { id: "publicar", label: "Publicar y eliminar artículos", hint: "Publicar, programar, despublicar y borrar", min: "editor", grupo: "Redactor" },
  { id: "borradores_ia", label: "Borradores de IA", hint: "Revisar, aprobar y descartar lo que propone la IA", min: "editor", grupo: "Redactor" },
  { id: "avisos", label: "Avisos", hint: "Crear y retirar avisos del sitio", min: "editor", grupo: "Redactor" },
  { id: "mensajes", label: "Mensajes recibidos", hint: "Leer contacto y solicitudes de pauta", min: "editor", grupo: "Configuración" },
  { id: "portada", label: "Portada, plantillas y secciones", hint: "Diseño del sitio, orden y menú de secciones", min: "administrador", grupo: "Diseño" },
  { id: "newsletter", label: "Newsletter", hint: "Ediciones, envíos y suscriptores", min: "editor", grupo: "Redactor" },
  { id: "analitica", label: "Centro de análisis", hint: "Qué leen, cuándo, desde dónde, y cómo crece la base de suscriptores", min: "editor", grupo: "Configuración" },
  { id: "biblioteca", label: "Biblioteca de imágenes", hint: "Crear carpetas, subir imágenes y asignarlas a personas", min: "administrador", grupo: "Redactor" },
  { id: "api", label: "API pública", hint: "Claves para terceros", min: "administrador", grupo: "Configuración" },
  // Entradas del menú que antes no se podían activar ni apagar por rol.
  { id: "resumen", label: "Resumen del panel", hint: "Estado editorial, audiencia y notas más leídas", min: "redactor", grupo: "Redactor" },
  { id: "pendientes", label: "Mis pendientes", hint: "Piezas del grupo de redacción y notas que te enviaron", min: "redactor", grupo: "Redactor" },
  { id: "imagenes", label: "Solicitud de imágenes", hint: "Recibir las portadas que piden los redactores y entregarlas", min: "redactor", grupo: "Redactor" },
  { id: "notas_editores", label: "Notas para editores", hint: "Preescribir una nota y enviarla a un editor", min: "redactor", grupo: "Redactor" },
  { id: "paginas", label: "Páginas", hint: "Crear páginas y armarlas con el constructor", min: "administrador", grupo: "Diseño" },
] as const satisfies readonly { id: string; label: string; hint: string; min: UserRole; /** Apartado del menú del panel al que pertenece. */ grupo: "Diseño" | "Redactor" | "Configuración" }[];

/** Apartados del menú, en el orden en que se muestran las casillas. */
export const GRUPOS_PERMISOS = ["Diseño", "Redactor", "Configuración"] as const;

// Identificador de un permiso.
export type PermisoId = (typeof PERMISOS)[number]["id"];
// Lista de ids de permiso, para validar entradas.
export const PERMISO_IDS: readonly string[] = PERMISOS.map((p) => p.id);
// Ajustes individuales: permisos encendidos o apagados y la exigencia de segundo factor.
export type Ajustes = Partial<Record<PermisoId | typeof DOS_PASOS, boolean>>;

/**
 * No es un permiso sino una exigencia: por defecto TODA cuenta debe tener 2FA.
 * El administrador puede eximir a una persona (casilla apagada). Un
 * administrador nunca queda exento.
 */
export const DOS_PASOS = "exigir_2fa";
// Indica si la persona debe usar segundo factor: los administradores siempre; el resto, salvo que se les exima.
export function exige2fa(role: UserRole, ajustes: Ajustes | undefined): boolean {
  if (role === "administrador") return true;
  return ajustes?.[DOS_PASOS] ?? true;
}

/** Lo que el rol da sin ajustes. */
export function porDefecto(role: UserRole, id: PermisoId): boolean {
  const p = PERMISOS.find((x) => x.id === id)!;
  // El diseñador tiene el rango de un redactor, pero además toca la portada, las plantillas y las secciones.
  if (role === "disenador" && (id === "portada" || id === "biblioteca" || id === "paginas")) return true;
  // Las entradas del menú que no siguen el rango: la solicitud de imágenes la reciben diseñadores, editores y administradores; «Mis pendientes»
  // no es para el diseñador (trabaja desde su solicitud de imágenes); las notas para editores las envían los redactores.
  if (id === "imagenes") return role !== "redactor";
  if (id === "pendientes") return role !== "disenador";
  if (id === "notas_editores") return role === "redactor" || role === "administrador";
  return RANGO[role] >= RANGO[p.min];
}

/** Permiso efectivo: el administrador siempre; el resto, rol + ajuste de la persona. */
export function efectivo(role: UserRole, ajustes: Ajustes | undefined, id: PermisoId): boolean {
  if (role === "administrador") return true;
  const a = ajustes?.[id];
  return typeof a === "boolean" ? a : porDefecto(role, id);
}

// Lista de permisos que una persona tiene realmente (su rol más los ajustes).
export function efectivos(role: UserRole, ajustes: Ajustes | undefined): PermisoId[] {
  return PERMISOS.filter((p) => efectivo(role, ajustes, p.id)).map((p) => p.id);
}

/**
 * Plazo de gracia para el segundo factor: un administrador puede dejar entrar sin 2FA a una cuenta nueva hasta una fecha. Pasada
 * esa fecha la exigencia vuelve sola, aunque nadie toque nada. `plazos` es `{ [userId]: fecha ISO }` (ver `getPlazos2fa`).
 * Función pura para poder probarla.
 */
export function enPlazoDosPasos(plazos: Record<string, string> | undefined, userId: string, ahora: Date = new Date()): { activo: boolean; hasta: Date | null } {
  const crudo = plazos?.[userId];
  const hasta = crudo ? new Date(crudo) : null;
  if (!hasta || Number.isNaN(hasta.getTime())) return { activo: false, hasta: null };
  return { activo: hasta.getTime() > ahora.getTime(), hasta };
}
