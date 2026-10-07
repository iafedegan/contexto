import { formatear, pct, ultimoConDato, variacion } from "@/lib/graficas";
import type { Indicador } from "@/lib/indicadores-fedegan";
import type { Observatorio } from "@/lib/observatorio-fedegan";

/**
 * «Lo que dicen los datos»: frases que se arman solas a partir de las cifras (nada escrito a mano), para que quien
 * entra al Observatorio entienda en diez segundos qué pasó. Es una función pura: la prueba cubre las frases y los casos
 * en que falta un dato (entonces esa frase simplemente no sale).
 */
export type Hallazgo = { tono: "sube" | "baja" | "dato"; texto: string };
type Idioma = "es" | "en";

const mes = (p: string, idioma: Idioma) => {
  const [m, a] = p.split("/");
  const largos: Record<string, [string, string]> = { ene: ["enero", "January"], feb: ["febrero", "February"], mar: ["marzo", "March"], abr: ["abril", "April"], may: ["mayo", "May"], jun: ["junio", "June"], jul: ["julio", "July"], ago: ["agosto", "August"], sep: ["septiembre", "September"], oct: ["octubre", "October"], nov: ["noviembre", "November"], dic: ["diciembre", "December"] };
  return a ? `${(largos[m] ?? [m, m])[idioma === "es" ? 0 : 1]} ${a}` : p;
};
const tono = (d: number | null): Hallazgo["tono"] => (d === null ? "dato" : d >= 0 ? "sube" : "baja");
const num = (v: number, idioma: Idioma, dec = 1) => v.toLocaleString(idioma === "es" ? "es-CO" : "en-US", { maximumFractionDigits: dec });

/** Hasta cuatro hallazgos: precio del gordo, región más cara del flaco, concentración del inventario y consumo. */
export function hallazgos(precios: Indicador[], obs: Observatorio, idioma: Idioma = "es"): Hallazgo[] {
  const salida: Hallazgo[] = [];
  const es = idioma === "es";

  const gordo = precios.find((p) => p.clave === "gordo");
  if (gordo) {
    const v = gordo.series[0].valores;
    const i = ultimoConDato(gordo.series);
    const d = variacion(v, i);
    if (v[i] !== null && v[i] !== undefined)
      salida.push({ tono: tono(d), texto: es ? `El ganado gordo cerró ${mes(gordo.periodos[i], idioma)} en ${formatear(v[i] as number, "pesos")} por kilo en pie${d !== null ? ` (${pct(d)} frente al mes anterior)` : ""}.` : `Fattened cattle closed ${mes(gordo.periodos[i], idioma)} at ${formatear(v[i] as number, "pesos")} per kilo on the hoof${d !== null ? ` (${pct(d)} vs the previous month)` : ""}.` });
  }

  const flaco = precios.find((p) => p.clave === "flaco-machos");
  if (flaco) {
    const i = ultimoConDato(flaco.series);
    const mejor = flaco.series.filter((s) => s.valores[i] !== null).sort((a, b) => (b.valores[i] as number) - (a.valores[i] as number))[0];
    if (mejor) {
      const d = variacion(mejor.valores, i);
      salida.push({ tono: tono(d), texto: es ? `El flaco macho más caro está en ${mejor.nombre.replace(/^Región /, "")}: ${formatear(mejor.valores[i] as number, "pesos")} por kilo${d !== null ? `, ${pct(d)} en el mes` : ""}.` : `The priciest feeder steer is in ${mejor.nombre.replace(/^Región /, "")}: ${formatear(mejor.valores[i] as number, "pesos")} per kilo${d !== null ? `, ${pct(d)} on the month` : ""}.` });
    }
  }

  const inv = obs.departamental.find((d) => d.clave === "bovinos");
  if (inv && inv.nacional.length) {
    const i = inv.nacional.length - 1;
    const total = inv.nacional[i];
    const mayor = inv.departamentos.filter((s) => s.valores[i] !== null).sort((a, b) => (b.valores[i] as number) - (a.valores[i] as number))[0];
    if (total && mayor)
      salida.push({ tono: "dato", texto: es ? `${mayor.nombre.trim()} concentra el ${num(((mayor.valores[i] as number) / total) * 100, idioma)} % de los bovinos del país: ${num((mayor.valores[i] as number) / 1e6, idioma, 2)} de ${num(total / 1e6, idioma, 1)} millones de cabezas.` : `${mayor.nombre.trim()} holds ${num(((mayor.valores[i] as number) / total) * 100, idioma)}% of the country's cattle: ${num((mayor.valores[i] as number) / 1e6, idioma, 2)} of ${num(total / 1e6, idioma, 1)} million head.` });
  }

  const res = obs.generales.find((g) => g.clave === "consumo-res");
  if (res) {
    const s = res.series.find((x) => /total/i.test(x.nombre)) ?? res.series[res.series.length - 1];
    const i = s.valores.length - 1 - [...s.valores].reverse().findIndex((v) => v !== null);
    const d = variacion(s.valores, i);
    if (s.valores[i] !== null && i >= 0)
      salida.push({ tono: tono(d), texto: es ? `Cada colombiano consume ${num(s.valores[i] as number, idioma)} kg de carne de res al año (${res.periodos[i]}).` : `Each Colombian eats ${num(s.valores[i] as number, idioma)} kg of beef a year (${res.periodos[i]}).` });
  }
  return salida;
}
