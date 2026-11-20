/**
 * ¿La firma de una cuenta debe tomar el nombre de la cuenta? Sí cuando la firma quedó con un nombre de usuario (una sola palabra, como
 * «pfonseca») y la cuenta ya tiene un nombre real con nombre y apellido. Sin base de datos, para poder probarlo.
 */
export function debeTomarNombreDeCuenta(firma: string, nombreCuenta: string): boolean {
  const f = firma.trim();
  const n = nombreCuenta.replace(/\s+/g, " ").trim();
  if (!n || f === n) return false;
  // Una sola palabra que NO es ninguna de las palabras del nombre real («Pfonseca», «pfonseca», «p.fonseca»): es el usuario, no un nombre.
  const sinTildes = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const palabras = sinTildes(n).split(" ");
  const pareceUsuario = !/\s/.test(f) && !palabras.includes(sinTildes(f));
  return pareceUsuario && n.includes(" ");
}
