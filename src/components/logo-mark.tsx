import Image from "next/image";

/**
 * El logo de CONtexto Ganadero: el emblema (el toro, los anillos y la «Cg») sobre una baldosa del verde de la página
 * (se genera con scripts/generar-logo.ts). Un solo componente para todas las apariciones del sitio (cabecera, pie, panel,
 * login, asistente…), para que cambiar el logo sea regenerar un archivo y no tocar diez sitios.
 */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo/contexto-ganadero-logo-v3-512.png"
      alt="CONtexto Ganadero"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
    />
  );
}
