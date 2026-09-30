"use client";

import { useActionState } from "react";
import { Turnstile } from "@/components/turnstile";
import { Check, Loader2, Mail, TriangleAlert } from "lucide-react";
import { suscribirBoletin, type BoletinState } from "@/app/acciones/boletin";
import { t, type Locale } from "@/lib/i18n";

/**
 * Alta al boletín (D-08: botón grande y con jerarquía). Se usa en la barra
 * lateral y al pie de la portada.
 */
export function NewsletterForm({ locale, compacto = false }: { locale: Locale; compacto?: boolean }) {
  const [state, action, pending] = useActionState<BoletinState, FormData>(suscribirBoletin, null);

  return (
    <form action={action} className={compacto ? "" : "lx-card p-6"}>
      <p className="lx-kicker flex items-center gap-2 text-[var(--accent)]">
        <Mail size={13} /> {t(locale, "newsletter.title")}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
        {t(locale, "newsletter.blurb")}
      </p>

      <input type="hidden" name="locale" value={locale} />
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {!compacto && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <input
                name="firstName"
                required
                autoComplete="given-name"
                placeholder={locale === "en" ? "First name" : "Nombre"}
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-2.5 text-[0.95rem] outline-none transition focus:border-[var(--accent)]"
              />
              <input
                name="lastName"
                required
                autoComplete="family-name"
                placeholder={locale === "en" ? "Last name" : "Apellidos"}
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-2.5 text-[0.95rem] outline-none transition focus:border-[var(--accent)]"
              />
            </div>
            <label className="flex flex-col gap-1 text-xs text-[var(--fg-muted)]">
              {locale === "en" ? "Date of birth" : "Fecha de nacimiento"}
              <input
                name="birthDate"
                type="date"
                required
                autoComplete="bday"
                className="lx-date-input w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-2.5 text-[0.95rem] text-[var(--fg)] outline-none transition [color-scheme:dark] focus:border-[var(--accent)]"
              />
            </label>
            <input
              name="mobile"
              type="tel"
              required
              autoComplete="tel-national"
              placeholder={locale === "en" ? "Mobile" : "Celular"}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-2.5 text-[0.95rem] outline-none transition focus:border-[var(--accent)]"
            />
            <input
              name="neighborhood"
              type="text"
              maxLength={120}
              autoComplete="address-level3"
              placeholder={locale === "en" ? "Neighborhood" : "Barrio"}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-2.5 text-[0.95rem] outline-none transition focus:border-[var(--accent)]"
            />
          </>
        )}

        <label className="sr-only" htmlFor={`boletin-${compacto ? "c" : "l"}`}>
          {t(locale, "newsletter.email")}
        </label>
        <input
          id={`boletin-${compacto ? "c" : "l"}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t(locale, "newsletter.email")}
          className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-2.5 text-[0.95rem] outline-none transition focus:border-[var(--accent)]"
        />
        <Turnstile />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-60"
        >
          {pending && <Loader2 size={15} className="animate-spin" />}
          {t(locale, "newsletter.cta")}
        </button>
      </div>

      {state && (
        <p
          role="status"
          className={`mt-3 flex items-start gap-2 text-xs leading-snug ${
            state.ok ? "text-[var(--accent-2)]" : "text-[var(--danger)]"
          }`}
        >
          {state.ok ? <Check size={13} className="mt-px shrink-0" /> : <TriangleAlert size={13} className="mt-px shrink-0" />}
          {state.message}
        </p>
      )}

      <p className="mt-3 text-[0.68rem] leading-snug text-[var(--fg-muted)]">
        {t(locale, "newsletter.legal")}
      </p>
    </form>
  );
}
