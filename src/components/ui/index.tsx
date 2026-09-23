import { cn } from "@/lib/utils";

/** Primitivas de UI. Estilo contemporáneo, sin dependencia de shadcn en el scaffold. */

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const variants = {
    primary:
      "bg-[var(--brand)] text-[var(--brand-fg)] shadow-[var(--shadow-sm)] hover:bg-[var(--brand-strong)]",
    outline:
      "border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--brand)] hover:text-[var(--brand)]",
    ghost: "text-[var(--ink-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
    danger: "bg-[var(--danger)] text-white hover:brightness-110",
  }[variant];
  const sizes = { sm: "px-3 py-1.5 text-[13px]", md: "px-4 py-2.5 text-sm" }[size];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
        variants,
        sizes,
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--ink)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] outline-none transition placeholder:text-[var(--ink-faint)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-tint)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-faint)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-tint)]",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "brand" | "warn" | "danger" | "ok";
}) {
  const tones = {
    neutral: "bg-[var(--surface-2)] text-[var(--ink-soft)]",
    brand: "bg-[var(--brand-tint)] text-[var(--brand-strong)]",
    warn: "bg-[color-mix(in_oklab,var(--warn)_16%,transparent)] text-[var(--warn)]",
    danger: "bg-[color-mix(in_oklab,var(--danger)_14%,transparent)] text-[var(--danger)]",
    ok: "bg-[var(--brand-tint)] text-[var(--brand-strong)]",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        tones,
        className,
      )}
      {...props}
    />
  );
}
