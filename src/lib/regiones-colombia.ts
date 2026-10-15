/**
 * Regiones naturales de Colombia para la sección «Regiones» (mapa interactivo y filtro de notas). `departamentos` usa los nombres del trazo
 * del mapa (src/lib/colombia-mapa.ts); `terminos` son las palabras (sin tildes, en minúscula) que buscan las notas de esa región.
 */
export type RegionColombia = { slug: string; nombre: string; color: string; departamentos: string[]; terminos: string[] };

export const REGIONES_COLOMBIA: RegionColombia[] = [
  { slug: "caribe", nombre: "Caribe", color: "#d97706", departamentos: ["ATLANTICO", "BOLIVAR", "CESAR", "CORDOBA", "LA GUAJIRA", "MAGDALENA", "SUCRE"], terminos: ["atlantico", "bolivar", "cesar", "cordoba", "guajira", "magdalena", "sucre", "caribe", "barranquilla", "cartagena", "santa marta", "monteria", "valledupar", "sincelejo", "riohacha"] },
  { slug: "andina", nombre: "Andina", color: "#16a34a", departamentos: ["ANTIOQUIA", "BOYACA", "CALDAS", "CUNDINAMARCA", "BOGOTA, D.C.", "HUILA", "NORTE DE SANTANDER", "QUINDIO", "RISARALDA", "SANTANDER", "TOLIMA"], terminos: ["antioquia", "boyaca", "caldas", "cundinamarca", "bogota", "huila", "norte de santander", "quindio", "risaralda", "santander", "tolima", "andina", "medellin", "manizales", "pereira", "armenia", "ibague", "neiva", "cucuta", "bucaramanga", "tunja"] },
  { slug: "pacifico", nombre: "Pacífico", color: "#0891b2", departamentos: ["CAUCA", "CHOCO", "NARINO", "VALLE DEL CAUCA"], terminos: ["cauca", "choco", "narino", "valle del cauca", "pacifico", "cali", "popayan", "pasto", "quibdo"] },
  { slug: "orinoquia", nombre: "Orinoquía", color: "#9333ea", departamentos: ["ARAUCA", "CASANARE", "META", "VICHADA"], terminos: ["arauca", "casanare", "meta", "vichada", "orinoquia", "llanos", "villavicencio", "yopal"] },
  { slug: "amazonia", nombre: "Amazonía", color: "#15803d", departamentos: ["AMAZONAS", "CAQUETA", "GUAINIA", "GUAVIARE", "PUTUMAYO", "VAUPES"], terminos: ["amazonas", "caqueta", "guainia", "guaviare", "putumayo", "vaupes", "amazonia", "florencia", "mocoa", "leticia"] },
  { slug: "insular", nombre: "Insular", color: "#2563eb", departamentos: [], terminos: ["san andres", "providencia", "insular", "archipielago"] },
];

export const regionPorSlug = (slug: string | undefined) => REGIONES_COLOMBIA.find((r) => r.slug === slug);
