import { cn } from "@/lib/utils";

/**
 * Primitivas de UI. Leen las variables del tema activo (`data-theme`), así que
 * el mismo botón se ve "pan de oro" en portada y "jade" en el panel.
 */

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
}) {
  const styles = {
    primary: "lx-btn",
    outline: "lx-btn lx-btn-ghost",
    ghost:
      "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-2)]",
    danger:
      "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90",
  }[variant];
  return <button className={cn(styles, "disabled:opacity-50", className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("lx-input", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("lx-input", className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("lx-card p-5", className)} {...props} />;
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("lx-chip", className)} {...props} />;
}
