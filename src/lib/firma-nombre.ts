/**
 * ¿La firma de una cuenta debe tomar el nombre de la cuenta? Solo cuando la firma ES el usuario de ESA persona: la parte del correo antes de
 * la @ («pfonseca» de pfonseca@…) o la inicial del nombre más el apellido («pfonseca» de Pedro Fonseca), con o sin mayúsculas o puntos.
 * Cualquier otra firma de una sola palabra se deja como está: una regla más suelta renombró por error una firma vinculada a otra cuenta.
 * Sin base de datos, para poder probarlo.
 */
const plano = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function debeTomarNombreDeCuenta(firma: string, nombreCuenta: string, correoCuenta = ""): boolean {
  const f = firma.trim();
  const n = nombreCuenta.replace(/\s+/g, " ").trim();
  if (!n || f === n || /\s/.test(f) || !n.includes(" ")) return false;
  const usuario = plano(f);
  if (!usuario) return false;
  const palabras = n.split(" ").map(plano).filter(Boolean);
  const inicialYApellido = palabras.length >= 2 ? palabras.slice(1).map((ap) => palabras[0][0] + ap) : [];
  const local = plano(correoCuenta.split("@")[0] ?? "");
  return usuario === local || inicialYApellido.includes(usuario);
}
