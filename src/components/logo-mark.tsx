import Image from "next/image";

/**
 * El logo de CONtexto Ganadero Media: la baldosa verde oscura con el emblema dorado (el archivo se genera con scripts/generar-logo.ts), recortada
 * en CÍRCULO. El círculo lleva el mismo verde de la baldosa (#0b2a1c) para que no asome un aro claro en las esquinas del recorte; el emblema
 * queda dentro del círculo sin encogerlo. Un solo componente para todas las apariciones
 * del sitio (cabecera, pie, panel, login, asistente…), para que cambiar el logo sea regenerar un archivo y no tocar diez sitios.
 */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0b2a1c] ${className}`}
      style={{ width: size, height: size }}
    >
      <Image src="/logo/contexto-ganadero-logo-v3-512.png" alt="CONtexto Ganadero Media" width={size} height={size} className="h-full w-full" />
    </span>
  );
}
