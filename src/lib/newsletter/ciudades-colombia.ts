/**
 * Centro aproximado de las ciudades colombianas más comunes, para ubicar en el mapa a quien se suscribió escribiendo su ciudad pero
 * sin que se guardaran coordenadas (altas anteriores, o sin permiso de ubicación). La clave va como la agrupa la audiencia: en
 * minúsculas, sin tildes y sin espacios de más. Si hay coordenadas reales, mandan siempre sobre esto.
 */
const CIUDADES: Record<string, [number, number]> = {
  bogota: [4.711, -74.0721], "bogota d.c.": [4.711, -74.0721], "bogota dc": [4.711, -74.0721],
  medellin: [6.2442, -75.5812], cali: [3.4516, -76.532], barranquilla: [10.9685, -74.7813], cartagena: [10.391, -75.4794],
  bucaramanga: [7.1193, -73.1227], cucuta: [7.8939, -72.5078], pereira: [4.8133, -75.6961], manizales: [5.0703, -75.5138],
  armenia: [4.5339, -75.6811], ibague: [4.4389, -75.2322], villavicencio: [4.142, -73.6266], pasto: [1.2136, -77.2811],
  monteria: [8.7479, -75.8814], neiva: [2.9273, -75.2819], valledupar: [10.4631, -73.2532], santa_marta: [11.2408, -74.199],
  "santa marta": [11.2408, -74.199], sincelejo: [9.3047, -75.3978], popayan: [2.4448, -76.6147], tunja: [5.5353, -73.3678],
  florencia: [1.6144, -75.6062], yopal: [5.3378, -72.3959], riohacha: [11.5444, -72.9072], quibdo: [5.6947, -76.6583],
  arauca: [7.0847, -70.7591], sogamoso: [5.7145, -72.9339], duitama: [5.8268, -73.0339], soacha: [4.5794, -74.2168],
  bello: [6.3373, -75.5547], itagui: [6.1846, -75.5991], envigado: [6.1759, -75.5917], palmira: [3.5394, -76.3036],
  buenaventura: [3.8801, -77.0312], tulua: [4.0847, -76.1954], girardot: [4.3, -74.8], zipaquira: [5.0221, -74.0048],
  chia: [4.8587, -74.0586], facatativa: [4.8139, -74.3544], fusagasuga: [4.3364, -74.3639], maicao: [11.3778, -72.2392],
  aguachica: [8.3103, -73.6272], barrancabermeja: [7.0653, -73.8547], ocana: [8.2378, -73.3558], pitalito: [1.8537, -76.0508],
  "puerto asis": [0.5058, -76.4944], leticia: [-4.2153, -69.9406], "san jose del guaviare": [2.5729, -72.6459],
};

/** Coordenadas aproximadas de una ciudad ya normalizada, o `null` si no la conocemos. */
export function centroDeCiudad(clave: string): { lat: number; lon: number } | null {
  const c = CIUDADES[clave.trim()];
  return c ? { lat: c[0], lon: c[1] } : null;
}
