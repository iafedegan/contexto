/**
 * El segmento /en necesita layout propio para que su `not-found.tsx` actúe
 * como frontera: sin layout, un `notFound()` sube hasta el 404 raíz (español).
 */
export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return children;
}
