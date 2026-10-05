/**
 * Iconos de redes dibujados aquí, no importados: lucide-react retiró los
 * logotipos de marca y añadir otra dependencia solo por cuatro glifos no
 * compensa. Son construcciones geométricas simples, legibles a 17 px.
 */
type Props = { size?: number; className?: string };

// Ícono de Facebook.
export function FacebookIcon({ size = 17, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M14.5 8.5h2.2V5.6c-.4-.05-1.7-.17-3.2-.17-3.2 0-5.1 1.9-5.1 5.4V13H5.8v3.3h2.6V24h3.9v-7.7h2.7l.5-3.3h-3.2v-2c0-1.6.5-2.5 1.2-2.5z" />
    </svg>
  );
}

// Ícono de Instagram.
export function InstagramIcon({ size = 17, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Ícono de Youtube.
export function YoutubeIcon({ size = 17, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className={className}>
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="M10.2 9.2 15 12l-4.8 2.8z" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Ícono de Linkedin.
export function LinkedinIcon({ size = 17, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M4.5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM2.9 8.7h3.2V21H2.9zM9.4 8.7h3.1v1.7a3.4 3.4 0 0 1 3-1.7c3.2 0 3.8 2.1 3.8 4.9V21h-3.2v-6.4c0-1.5 0-3.5-2.1-3.5s-2.4 1.6-2.4 3.4V21H9.4z" />
    </svg>
  );
}

// Ícono de X (Twitter).
export function XIcon({ size = 17, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className={className}>
      <path d="M4 4 20 20M20 4 4 20" />
    </svg>
  );
}

// Ícono de Whatsapp.
export function WhatsappIcon({ size = 17, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.7-5.2A8.5 8.5 0 1 1 21 11.5z" />
      <path d="M8.6 9c.3 1.9 2.4 4.1 4.4 4.7l1-1.3 2 .9-.4 1.6c-2.8.5-6.7-2.9-7.6-6l1.5-.7z" fill="currentColor" stroke="none" />
    </svg>
  );
}
