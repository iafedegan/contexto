import { cn } from "@/lib/utils";

/**
 * Primitivas de UI mínimas (estilo shadcn/ui, sin la dependencia completa en el
 * scaffold). Sustituibles por `npx shadcn@latest add ...` cuando se amplíe.
 */

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-[var(--brand)] text-[var(--brand-fg)] hover:opacity-90",
    outline: "border border-[var(--border)] hover:bg-[var(--bg-subtle)]",
    ghost: "hover:bg-[var(--bg-subtle)]",
    danger: "bg-[var(--danger)] text-white hover:opacity-90",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        styles,
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
        "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]",
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
        "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]",
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
        "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-4",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--fg-muted)]",
        className,
      )}
      {...props}
    />
  );
}
