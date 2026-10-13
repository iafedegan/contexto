import type { Locale } from "@/lib/i18n";

/** Menú secundario del §2.2, en el orden del anexo funcional. */
export const MENU_SECUNDARIO: { slug: string; label: Record<Locale, string> }[] = [
  { slug: "contacto", label: { es: "Contacto", en: "Contact" } },
  { slug: "quienes-somos", label: { es: "Quiénes somos", en: "About us" } },
  { slug: "preguntas-frecuentes", label: { es: "Preguntas frecuentes", en: "FAQ" } },
  { slug: "paute-con-nosotros", label: { es: "Paute con nosotros", en: "Advertise with us" } },
  { slug: "terminos-y-condiciones", label: { es: "Términos y condiciones", en: "Terms of use" } },
  { slug: "politica-de-privacidad", label: { es: "Política de privacidad", en: "Privacy policy" } },
  { slug: "politica-de-cookies", label: { es: "Política de cookies", en: "Cookie policy" } },
  { slug: "politica-editorial", label: { es: "Política editorial", en: "Editorial policy" } },
  { slug: "politica-de-ia", label: { es: "Uso de inteligencia artificial", en: "AI use policy" } },
  { slug: "derechos-de-autor", label: { es: "Derechos de autor", en: "Copyright" } },
];
