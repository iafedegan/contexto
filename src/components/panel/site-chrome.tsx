import type { SitePreviewChrome } from "@/components/panel/site-article-preview";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { navItems, navOverflow } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";
import { getSiteIdentity } from "@/lib/site-identity";

/** Cabecera, pie y tema reales del sitio para la vista previa del asistente. */
export async function siteChrome(): Promise<SitePreviewChrome> {
  const [site, nav, extra, identity] = await Promise.all([
    getSiteTheme(),
    navItems(),
    navOverflow(),
    getSiteIdentity(),
  ]);
  return {
    theme: site.theme,
    style: site.style,
    css: site.css,
    header: <SiteHeader theme={site.theme} nav={nav} extraNav={extra} identity={identity} />,
    footer: <SiteFooter theme={site.theme} nav={nav} identity={identity} />,
  };
}
