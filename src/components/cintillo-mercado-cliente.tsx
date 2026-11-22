"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { esObjeto, useRecurso } from "@/lib/recurso-cliente";
import { BotonPausaCss } from "@/components/ui/boton-pausa";
import { CintilloTira, type PiezaTira } from "@/components/cintillo-tira";

/** Lo que pinta la tira del cintillo, ya calculado y formateado en el servidor (`datosDelCintillo`). */
export type DatosCintillo = { piezas: PiezaTira[]; veces: number; segundos: number; color?: string };

// ¿La respuesta de `/api/cintillo` tiene la forma que pinta la tira? Si no, el cintillo no se muestra.
const esPieza = (p: unknown) => esObjeto(p) && typeof p.clave === "string" && typeof p.texto === "string" && (p.sube === null || typeof p.sube === "boolean");
const sonDatosCintillo = (v: unknown): v is DatosCintillo =>
  esObjeto(v) && Array.isArray(v.piezas) && v.piezas.every(esPieza) && typeof v.veces === "number" && v.veces >= 1 && v.veces <= 50 && typeof v.segundos === "number" && (v.color === undefined || typeof v.color === "string");

/**
 * Cintillo de cotizaciones (economía) en lo más alto de la página: fondo verde oscuro, nombre en negrita, valor y la variación con flecha
 * verde o roja, y debajo la cinta de seis colores de la marca. Con `datos` (portada, secciones) se pinta tal cual llegan del servidor.
 * Sin `datos` (notas y autores, que son estáticos) el marco sale ya en el HTML con su alto reservado y las cotizaciones se piden a
 * `/api/cintillo`: así la actualización diaria de los precios no obliga a regenerar las notas guardadas. Si no hay cotizaciones, o la
 * petición falla o tarda más de 5 s, no pinta nada (el marco reservado se quita): la nota se ve igual, sin cintillo.
 */
export function CintilloMercadoCliente({ locale, datos }: { locale: Locale; datos?: DatosCintillo }) {
  const pathname = usePathname();
  const pedidos = useRecurso(datos ? null : `/api/cintillo?l=${locale}`, sonDatosCintillo, pathname);
  const d = datos ?? pedidos.valor;
  // Falló, o llegó y no trae nada (apagado o sin datos): sin cintillo, como cuando se pintaba en el servidor.
  if ((!datos && pedidos.fallo) || (d && d.piezas.length === 0)) return null;
  return (
    <div role="region" aria-label={locale === "en" ? "Market prices" : "Cotizaciones del mercado"} data-pausable data-region="cintillo" data-el="h-cintillo" className="cg-cintillo-arriba bg-[#003e41] pt-[env(safe-area-inset-top)] text-white [--fg:#ffffff]">
      <div className="relative overflow-hidden py-2">
        {/* WCAG 2.2.2: lo que se mueve solo se puede detener. */}
        <BotonPausaCss className="absolute right-1 top-1/2 z-10 !size-6 -translate-y-1/2 bg-[#003e41] ring-1 ring-white/30" />
        {d ? (
          <CintilloTira piezas={d.piezas} veces={d.veces} segundos={d.segundos} color={d.color} />
        ) : (
          // Mientras llegan las cotizaciones: una línea vacía con la misma letra que la tira, para que la página no salte al llenarse.
          <div aria-hidden className="lx-marquee !gap-0 items-center text-[0.8rem] font-medium">
            <span className="flex items-center gap-2 whitespace-nowrap">&nbsp;</span>
          </div>
        )}
      </div>
      <div aria-hidden className="flex h-[2px] w-full">
        {["#d9a41a", "#f7eea1", "#138984", "#003e41", "#138984", "#d9a41a"].map((c, i) => (
          <span key={`${c}-${i}`} className="cg-cinta-tramo h-full flex-1" style={{ "--c": c } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}
