"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Card, Input } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/panel";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("password"),
      totp: fd.get("totp"),
      redirect: false,
    });
    setPending(false);
    if (res?.error) {
      setError("Credenciales o código de verificación inválidos.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm p-7 shadow-[var(--shadow-lg)]">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand)] text-[13px] font-black text-[var(--brand-fg)]">
          CG
        </span>
        <div>
          <h1 className="text-[15px] font-extrabold leading-tight">Panel editorial</h1>
          <p className="text-xs text-[var(--ink-faint)]">CONtexto Ganadero</p>
        </div>
      </div>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[var(--ink-soft)]">
          Correo
          <Input name="email" type="email" required autoComplete="username" />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[var(--ink-soft)]">
          Contraseña
          <Input name="password" type="password" required autoComplete="current-password" />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[var(--ink-soft)]">
          Código 2FA <span className="font-normal text-[var(--ink-faint)]">(si está activado)</span>
          <Input name="totp" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" />
        </label>
        {error && (
          <p className="rounded-[var(--radius-sm)] bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] px-3 py-2 text-[13px] text-[var(--danger)]">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="mt-1">
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--surface-2)] p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
