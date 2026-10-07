import { DIAS_LARGOS, duracion, franja, indiceDia, parte } from "@/lib/lectores-formato";
import { departamentoDeRegion, nombreDeDepartamento } from "@/lib/lectores-geo";
import type { Panorama } from "@/lib/lectores-consulta";

/**
 * «Lo que dicen los datos» de la audiencia: frases que se arman solas con lo que mide el panel (nada escrito a mano), para
 * que quien abre el centro de análisis entienda en diez segundos qué pasa. Si falta un dato, esa frase no sale. Pura y probada.
 */
export type HallazgoAudiencia = { tono: "bien" | "alerta" | "dato"; texto: string };
const pc = (v: number) => `${v.toLocaleString("es-CO", { maximumFractionDigits: 0 })} %`;

export function hallazgosAudiencia(p: Pick<Panorama, "indicadores" | "calor" | "dispositivos" | "fuentes" | "regiones" | "embudo">): HallazgoAudiencia[] {
  const i = p.indicadores;
  if (i.lecturas < 5) return []; // con tan pocas lecturas cualquier frase sería ruido
  const salida: HallazgoAudiencia[] = [];

  const mejor = [...p.calor].sort((a, b) => b.n - a.n)[0];
  if (mejor && mejor.n > 0)
    salida.push({ tono: "dato", texto: `Se lee más los ${DIAS_LARGOS[indiceDia(mejor.dow)]}, de ${franja(mejor.hora)} (${pc(parte(mejor.n, i.lecturas))} de las lecturas): la mejor franja para publicar o enviar el boletín.` });

  const completas = parte(i.completas, i.lecturas);
  salida.push({
    tono: completas >= 35 ? "bien" : completas < 15 ? "alerta" : "dato",
    texto: `${pc(completas)} de las lecturas llegan hasta el final de la nota; la persona típica se queda ${duracion(i.segundosMediana)} y baja el ${pc(i.scrollMedio)} del texto.`,
  });

  const rebote = parte(i.rebotes, i.lecturas);
  if (rebote >= 25) salida.push({ tono: "alerta", texto: `${pc(rebote)} de quienes entran se van en menos de 10 segundos sin bajar: conviene revisar el titular, la portada o la velocidad de carga.` });

  const disp = p.dispositivos[0];
  if (disp && disp.clave !== "Sin dato")
    salida.push({ tono: "dato", texto: `${pc(parte(disp.lecturas, i.lecturas))} lee desde ${({ mobile: "el celular", desktop: "un computador", tablet: "una tableta", otro: "otros dispositivos" } as Record<string, string>)[disp.clave] ?? disp.clave}.` });

  const fuente = p.fuentes[0];
  if (fuente) salida.push({ tono: "dato", texto: `La principal puerta de entrada es «${fuente.clave}» (${pc(parte(fuente.lecturas, i.lecturas))} de las lecturas).` });

  const recurrentes = parte(i.recurrentes, i.lecturas);
  salida.push({ tono: recurrentes >= 30 ? "bien" : "dato", texto: `${pc(recurrentes)} de las lecturas son de personas que ya habían leído antes: ${recurrentes >= 30 ? "hay un público que vuelve" : "la mayoría es público nuevo"}.` });

  const dep = p.regiones.map((r) => ({ ...r, depto: departamentoDeRegion(r.clave) })).filter((r) => r.depto).sort((a, b) => b.lecturas - a.lecturas)[0];
  if (dep?.depto) salida.push({ tono: "dato", texto: `${nombreDeDepartamento(dep.depto)} es el departamento con más lectura (${pc(parte(dep.lecturas, i.lecturas))}).` });
  return salida.slice(0, 6);
}
