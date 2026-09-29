import Image from "next/image";

/**
 * El logo real de CONtexto Ganadero, en vez del distintivo tipográfico "CG"
 * que se usaba de marcador de posición. Un solo componente para las ~10
 * apariciones del sitio (cabecera, pie, panel, login, asistente…) para que
 * cambiar el logo alguna vez sea editar un archivo, no diez.
 */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo/contexto-ganadero-logo.jpg"
      alt="CONtexto Ganadero"
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  );
}
