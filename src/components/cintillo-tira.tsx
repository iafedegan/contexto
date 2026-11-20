"use client";

/**
 * La tira que se mueve del cintillo de cotizaciones. Es de cliente solo para que los datos de React de cada página lleven las 2 o 3
 * cotizaciones y no las 24 copias que pinta la tira (se repiten para llenar pantallas anchas y van dos veces para dar la vuelta sin salto).
 * El HTML que sale es el mismo de antes. Los números ya llegan formateados del servidor (así no cambian al hidratar).
 */

export type PiezaTira = {
  clave: string;
  tipo: "texto" | "mercado" | "nota";
  texto: string;
  etiqueta?: string;
  valor?: string;
  /** true sube, false baja, null sin variación conocida. */
  sube: boolean | null;
  /** Variación ya formateada (sin signo), p. ej. «2,65». */
  cambioTexto?: string;
};

export function CintilloTira({ piezas, veces, segundos, color }: { piezas: PiezaTira[]; veces: number; segundos: number; color?: string }) {
  const vuelta = Array.from({ length: veces }, () => piezas).flat();
  const pieza = (p: PiezaTira, i: number) =>
    p.tipo === "mercado" && p.etiqueta ? (
      <span key={`${p.clave}-${i}`} className="flex items-center gap-2 whitespace-nowrap tabular-nums">
        <span className="font-bold">{p.etiqueta}</span>
        <span className="opacity-90">{p.valor}</span>
        {p.sube !== null && (
          <span className="font-bold">
            {/* Solo la flecha lleva el verde o el rojo; el número sigue el color de letra del cintillo. */}
            <span data-color-propio className="text-[color:var(--color-propio)]" style={{ "--color-propio": p.sube ? "#4ade80" : "#f87171" } as React.CSSProperties}>
              {p.sube ? "▲" : "▼"}
            </span>{" "}
            {p.cambioTexto}%
          </span>
        )}
      </span>
    ) : (
      <span key={`${p.clave}-${i}`} className={`flex items-center gap-2 whitespace-nowrap ${p.tipo === "nota" ? "" : "font-bold"}`}>
        <span className="text-[0.6rem] text-[#f2a900]">◆</span>
        {p.texto}
      </span>
    );
  return (
    <div
      className="lx-marquee !gap-0 items-center text-[0.8rem] font-medium text-[color:var(--cin,#ffffff)]"
      style={{ "--lx-marquee-s": `${segundos}s`, ...(color ? { "--cin": color } : {}) } as React.CSSProperties}
    >
      {/* Dos copias idénticas, cada una con su espacio final: al avanzar media tira la segunda queda justo donde empezó la primera y reinicia sin salto. */}
      {[0, 1].map((k) => (
        <div key={k} aria-hidden={k === 1} className="flex shrink-0 items-center gap-8 pr-8">
          {vuelta.map(pieza)}
        </div>
      ))}
    </div>
  );
}
