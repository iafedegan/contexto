import Image from "next/image";

/**
 * El logo de CONtexto Ganadero: el emblema (el toro, los anillos y la «Cg») dentro de un CÍRCULO del tono claro de la baldosa
 * (el archivo se genera con scripts/generar-logo.ts). El emblema ocupa casi todo el ancho de la baldosa, así que dentro del círculo
 * se reduce un poco (`scale`) para que las puntas de los cuernos no queden cortadas. Un solo componente para todas las apariciones
 * del sitio (cabecera, pie, panel, login, asistente…), para que cambiar el logo sea regenerar un archivo y no tocar diez sitios.
 */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6f8f3] ${className}`}
      style={{ width: size, height: size }}
    >
      <Image src="/logo/contexto-ganadero-logo-v3-512.png" alt="CONtexto Ganadero" width={size} height={size} className="h-full w-full scale-[0.84]" />
    </span>
  );
}
