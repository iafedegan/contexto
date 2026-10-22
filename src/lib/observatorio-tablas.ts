import "server-only";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { observatorioDatos } from "@/db/schema";
import type { Indicador } from "@/lib/indicadores-fedegan";
import type { Observatorio } from "@/lib/observatorio-fedegan";
import { aplanarIndicadores, aplanarObservatorio, TEMAS_OBSERVATORIO, TEMAS_PRECIOS, type FilaCifra } from "@/lib/observatorio-aplanar";

const TANDA = 1000;

// Reemplaza todas las filas de `temas` por `filas`, en una sola transacción: quien consulta nunca ve la tabla a medias.
async function reemplazar(temas: readonly string[], filas: FilaCifra[]) {
  await db.transaction(async (tx) => {
    await tx.delete(observatorioDatos).where(inArray(observatorioDatos.tema, [...temas]));
    for (let i = 0; i < filas.length; i += TANDA) {
      await tx.insert(observatorioDatos).values(filas.slice(i, i + TANDA)).onConflictDoUpdate({
        target: [observatorioDatos.tema, observatorioDatos.indicador, observatorioDatos.serie, observatorioDatos.periodo],
        set: { valor: sql`excluded.valor`, actualizadoEn: sql`now()` },
      });
    }
  });
}

/** Deja en `observatorio_datos` las cifras del Observatorio (inventario, producción, consumo, internacional, costos). */
export async function guardarCifrasObservatorio(o: Observatorio): Promise<void> {
  const filas = aplanarObservatorio(o);
  if (filas.length) await reemplazar(TEMAS_OBSERVATORIO, filas);
}

/** Deja en `observatorio_datos` los precios de la portada (tema «precios»). */
export async function guardarCifrasPrecios(p: Indicador[]): Promise<void> {
  const filas = aplanarIndicadores(p);
  if (filas.length) await reemplazar(TEMAS_PRECIOS, filas);
}
