import type { StructuredSource } from "./draft-generator";

/**
 * Fuentes estructuradas de demostración para el agente de producción editorial.
 * En producción estas llegan de integraciones reales (SIPSA, salas de prensa de
 * gremios, ICA, agenda de ferias). Aquí sirven para mostrar el flujo completo:
 * fuente estructurada -> borrador -> verificación -> cola de aprobación.
 */
export type DemoSource = StructuredSource & { key: string; label: string; description: string };

export const DEMO_SOURCES: DemoSource[] = [
  {
    key: "boletin_precios_medellin",
    label: "Boletín de precios — Medellín",
    description: "Cierre semanal de la Central Ganadera de Medellín.",
    kind: "boletin_precios",
    ref: "SIPSA — boletín semanal, plaza Medellín (semana 37)",
    payload: {
      plaza: "Medellín",
      semana: 37,
      fecha_cierre: "2026-09-11",
      categorias: [
        { nombre: "novillo gordo", precio_kg_cop: 9990, unidad: "COP/kg en pie" },
        { nombre: "vaca gorda", precio_kg_cop: 8730, unidad: "COP/kg en pie" },
        { nombre: "ternero destete", precio_kg_cop: 12450, unidad: "COP/kg en pie" },
      ],
      volumen_cabezas: 4120,
      fuente: "Central Ganadera de Medellín",
    },
    rawText: `Boletín de precios — Central Ganadera de Medellín. Semana 37, cierre 11 de septiembre de 2026.
Novillo gordo: 9.990 COP/kg en pie. Vaca gorda: 8.730 COP/kg en pie. Ternero de destete: 12.450 COP/kg en pie.
Volumen movilizado en la semana: 4.120 cabezas. Fuente: Central Ganadera de Medellín.`,
  },
  {
    key: "comunicado_gremio_vacunacion",
    label: "Comunicado — ciclo de vacunación",
    description: "Sala de prensa del gremio ganadero nacional.",
    kind: "comunicado",
    ref: "Comunicado de prensa Fedegán N.º 214",
    payload: {
      titulo: "Inicia el segundo ciclo de vacunación de 2026",
      fecha_inicio: "2026-11-03",
      fecha_fin: "2026-12-15",
      biologicos: ["fiebre aftosa", "brucelosis bovina"],
      meta_cobertura_pct: 96,
      hato_objetivo_millones: 29.4,
      tarifa_dosis_cop: 1350,
      vocero: "Coordinación Nacional de Sanidad Animal",
    },
    rawText: `El segundo ciclo de vacunación de 2026 se realizará entre el 3 de noviembre y el 15 de diciembre.
Se aplicarán biológicos contra fiebre aftosa y brucelosis bovina. La meta de cobertura es del 96 % de un hato
objetivo de 29,4 millones de animales. La tarifa por dosis aplicada será de 1.350 pesos. Información de la
Coordinación Nacional de Sanidad Animal.`,
  },
  {
    key: "convocatoria_credito",
    label: "Convocatoria — línea de crédito",
    description: "Convocatoria pública de financiación para praderas.",
    kind: "convocatoria",
    ref: "Convocatoria Finagro — línea especial praderas 2026-B",
    payload: {
      nombre: "Línea especial de crédito para renovación de praderas",
      entidad: "Finagro",
      monto_bolsa_millones_cop: 45000,
      tasa_ea_pct: 9.5,
      plazo_meses: 60,
      periodo_gracia_meses: 12,
      apertura: "2026-09-20",
      cierre: "2026-11-30",
      beneficiarios: "pequeños y medianos productores",
    },
    rawText: `Finagro abre la línea especial de crédito para renovación de praderas 2026-B. Bolsa de 45.000 millones
de pesos. Tasa de 9,5 % efectivo anual, plazo de 60 meses con 12 meses de periodo de gracia. La convocatoria
abre el 20 de septiembre y cierra el 30 de noviembre de 2026. Dirigida a pequeños y medianos productores.`,
  },
  {
    key: "agenda_feria_cebu",
    label: "Agenda — feria ganadera",
    description: "Ficha de evento para la agenda del sector.",
    kind: "agenda_ferias",
    ref: "Agenda sectorial — Feria Nacional Cebú 2026",
    payload: {
      evento: "Feria Nacional Cebú 2026",
      ciudad: "Montería",
      recinto: "Recinto ferial de Córdoba",
      fecha_inicio: "2026-10-16",
      fecha_fin: "2026-10-20",
      expositores_estimados: 180,
      subastas: 3,
      remate_genetica: "2026-10-19",
    },
    rawText: `La Feria Nacional Cebú 2026 se celebrará del 16 al 20 de octubre en el recinto ferial de Córdoba, en
Montería. Se esperan 180 expositores y se realizarán 3 subastas. El remate de genética está programado para el
19 de octubre.`,
  },
];

export function getDemoSource(key: string): DemoSource | undefined {
  return DEMO_SOURCES.find((s) => s.key === key);
}
