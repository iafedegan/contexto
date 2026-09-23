import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[var(--maxw)] flex-1 px-4 py-10 sm:py-12">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
