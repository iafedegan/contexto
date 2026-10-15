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

/** Un departamento filtrable: `mapa` es su nombre en el trazo del mapa; `terminos` lo que lo identifica en el texto de una nota. */
export type DepartamentoFiltro = { slug: string; nombre: string; mapa: string; region: string; terminos: string[] };

// [nombre en el mapa, nombre para mostrar, términos (sin tildes), región]
const BASE: [string, string, string[], string][] = [
  ["ANTIOQUIA", "Antioquia", ["antioquia", "medellin"], "andina"],
  ["BOYACA", "Boyacá", ["boyaca", "tunja", "duitama", "sogamoso"], "andina"],
  ["CALDAS", "Caldas", ["caldas", "manizales"], "andina"],
  ["CUNDINAMARCA", "Cundinamarca", ["cundinamarca", "bogota"], "andina"],
  ["HUILA", "Huila", ["huila", "neiva"], "andina"],
  ["NORTE DE SANTANDER", "Norte de Santander", ["norte de santander", "cucuta"], "andina"],
  ["QUINDIO", "Quindío", ["quindio", "armenia"], "andina"],
  ["RISARALDA", "Risaralda", ["risaralda", "pereira"], "andina"],
  ["SANTANDER", "Santander", ["santander", "bucaramanga"], "andina"],
  ["TOLIMA", "Tolima", ["tolima", "ibague"], "andina"],
  ["ATLANTICO", "Atlántico", ["atlantico", "barranquilla"], "caribe"],
  ["BOLIVAR", "Bolívar", ["bolivar", "cartagena"], "caribe"],
  ["CESAR", "Cesar", ["cesar", "valledupar"], "caribe"],
  ["CORDOBA", "Córdoba", ["cordoba", "monteria"], "caribe"],
  ["LA GUAJIRA", "La Guajira", ["guajira", "riohacha"], "caribe"],
  ["MAGDALENA", "Magdalena", ["magdalena", "santa marta"], "caribe"],
  ["SUCRE", "Sucre", ["sucre", "sincelejo"], "caribe"],
  ["CAUCA", "Cauca", ["cauca", "popayan"], "pacifico"],
  ["CHOCO", "Chocó", ["choco", "quibdo"], "pacifico"],
  ["NARINO", "Nariño", ["narino", "pasto"], "pacifico"],
  ["VALLE DEL CAUCA", "Valle del Cauca", ["valle del cauca", "cali"], "pacifico"],
  ["ARAUCA", "Arauca", ["arauca"], "orinoquia"],
  ["CASANARE", "Casanare", ["casanare", "yopal"], "orinoquia"],
  ["META", "Meta", ["meta", "villavicencio"], "orinoquia"],
  ["VICHADA", "Vichada", ["vichada", "puerto carreno"], "orinoquia"],
  ["AMAZONAS", "Amazonas", ["amazonas", "leticia"], "amazonia"],
  ["CAQUETA", "Caquetá", ["caqueta", "florencia"], "amazonia"],
  ["GUAINIA", "Guainía", ["guainia", "inirida"], "amazonia"],
  ["GUAVIARE", "Guaviare", ["guaviare", "san jose del guaviare"], "amazonia"],
  ["PUTUMAYO", "Putumayo", ["putumayo", "mocoa"], "amazonia"],
  ["VAUPES", "Vaupés", ["vaupes", "mitu"], "amazonia"],
  ["", "San Andrés y Providencia", ["san andres", "providencia"], "insular"],
];
const slugDe = (n: string) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const DEPARTAMENTOS_FILTRO: DepartamentoFiltro[] = BASE.map(([mapa, nombre, terminos, region]) => ({ slug: slugDe(nombre), nombre, mapa, region, terminos }));
export const departamentoPorSlug = (slug: string | undefined) => DEPARTAMENTOS_FILTRO.find((d) => d.slug === slug);
