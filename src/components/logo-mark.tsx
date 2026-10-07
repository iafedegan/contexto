import Image from "next/image";

/**
 * El logo de CONtexto Ganadero: el monograma «Cg» sobre una baldosa esmeralda (se dibuja en src/lib/logo.ts). Un solo
 * componente para todas las apariciones del sitio (cabecera, pie, panel, login, asistente…), para que cambiar el logo
 * sea regenerar un archivo y no tocar diez sitios. Es vectorial: `unoptimized` porque el optimizador de imágenes no
 * tiene nada que hacerle, y se ve nítido a cualquier tamaño.
 */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo/contexto-ganadero-logo.svg"
      alt="CONtexto Ganadero"
      width={size}
      height={size}
      unoptimized
      className={`shrink-0 ${className}`}
    />
  );
}
