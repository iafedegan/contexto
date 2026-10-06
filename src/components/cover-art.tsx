import Image from "next/image";

/**
 * Paleta curada: ámbar, oro viejo, oliva, esmeralda, petróleo, ciruela y
 * burdeos. Evita los tonos chillones que rompen la elegancia del tema.
 */
const HUES = [28, 48, 96, 152, 196, 288, 344];

/** Hash estable (djb2) → tono reproducible en servidor y cliente. */
function hue(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (h * 33) ^ seed.charCodeAt(i);
  return HUES[Math.abs(h) % HUES.length];
}

/**
 * Portada generada para artículos sin imagen: malla de degradados en oklch +
 * monograma. Determinista por slug, así la portada no "baila" entre renders.
 */
export function CoverArt({
  seed,
  label,
  className = "text-[5rem]",
}: {
  seed: string;
  label?: string | null;
  className?: string;
}) {
  const h = hue(seed);
  const h2 = (h + 26) % 360;
  const h3 = (h + 330) % 360;
  const initial = (label ?? seed).trim().charAt(0).toUpperCase();

  return (
    <div
      className={`lx-art ${className}`}
      aria-hidden
      style={{
        backgroundImage: [
          `radial-gradient(70% 90% at 18% 12%, oklch(0.46 0.095 ${h}) 0%, transparent 62%)`,
          `radial-gradient(60% 80% at 88% 24%, oklch(0.38 0.085 ${h2}) 0%, transparent 60%)`,
          `radial-gradient(90% 70% at 60% 96%, oklch(0.26 0.06 ${h3}) 0%, transparent 70%)`,
          `linear-gradient(145deg, oklch(0.2 0.035 ${h}) 0%, oklch(0.13 0.02 ${h3}) 100%)`,
        ].join(","),
      }}
    >
      <span className="lx-display relative z-[1] select-none font-semibold leading-none text-white/75 mix-blend-overlay">
        {initial}
      </span>
    </div>
  );
}

/** Imagen real si existe; si no, la portada generada. Misma caja siempre. */
export function CardMedia({
  src,
  alt,
  seed,
  label,
  ratio = "aspect-[16/10]",
  priority = false,
  sizes = "(min-width: 1024px) 33vw, 100vw",
}: {
  src: string | null;
  alt: string;
  seed: string;
  label?: string | null;
  ratio?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div className={`lx-media relative w-full overflow-hidden ${ratio}`}>
      {src ? (
        <Image src={src} alt={alt} fill priority={priority} fetchPriority={priority ? "high" : undefined} sizes={sizes} quality={75} className="object-cover" />
      ) : (
        <CoverArt seed={seed} label={label} className="absolute inset-0 text-[6rem]" />
      )}
    </div>
  );
}
