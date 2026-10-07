/**
 * Región de Vercel (`x-vercel-ip-country-region`, subdivisión ISO 3166-2 de Colombia) → departamento, con el nombre que usa
 * el mapa (`colombia-mapa.ts`) para pintar la lectura por departamento.
 */
const DEPARTAMENTO_DE_REGION: Record<string, string> = {
  AMA: "AMAZONAS", ANT: "ANTIOQUIA", ARA: "ARAUCA", ATL: "ATLANTICO", BOL: "BOLIVAR", BOY: "BOYACA", CAL: "CALDAS", CAQ: "CAQUETA",
  CAS: "CASANARE", CAU: "CAUCA", CES: "CESAR", CHO: "CHOCO", COR: "CORDOBA", CUN: "CUNDINAMARCA", DC: "BOGOTA DC", GUA: "GUAINIA",
  GUV: "GUAVIARE", HUI: "HUILA", LAG: "LA GUAJIRA", MAG: "MAGDALENA", MET: "META", NAR: "NARINO", NSA: "NORTE DE SANTANDER",
  PUT: "PUTUMAYO", QUI: "QUINDIO", RIS: "RISARALDA", SAN: "SANTANDER", SAP: "SAN ANDRES", SUC: "SUCRE", TOL: "TOLIMA",
  VAC: "VALLE DEL CAUCA", VAU: "VAUPES", VID: "VICHADA",
};

/** Nombre normalizado del departamento (como `normaDepartamento`), o `null` si el código no es de Colombia. */
export function departamentoDeRegion(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  return DEPARTAMENTO_DE_REGION[codigo.trim().toUpperCase().replace(/^CO-/, "")] ?? null;
}

/** Nombre para mostrar de un departamento normalizado: «NORTE DE SANTANDER» → «Norte de Santander». */
export function nombreDeDepartamento(norma: string): string {
  const chicas = new Set(["DE", "DEL", "LA", "Y"]);
  const especial: Record<string, string> = { "BOGOTA DC": "Bogotá D.C.", NARINO: "Nariño", ATLANTICO: "Atlántico", BOLIVAR: "Bolívar", BOYACA: "Boyacá", CAQUETA: "Caquetá", CHOCO: "Chocó", CORDOBA: "Córdoba", GUAINIA: "Guainía", QUINDIO: "Quindío", VAUPES: "Vaupés", "SAN ANDRES": "San Andrés" };
  return especial[norma] ?? norma.toLowerCase().split(" ").map((p, i) => (i > 0 && chicas.has(p.toUpperCase()) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(" ");
}
