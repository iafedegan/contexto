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
    <Card className="w-full max-w-sm">
      <h1 className="text-lg font-bold">Panel editorial</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">CONtexto Ganadero</p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <label className="text-sm">
          Correo
          <Input name="email" type="email" required autoComplete="username" />
        </label>
        <label className="text-sm">
          Contraseña
          <Input name="password" type="password" required autoComplete="current-password" />
        </label>
        <label className="text-sm">
          Código 2FA <span className="text-[var(--fg-muted)]">(si está activado)</span>
          <Input name="totp" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" />
        </label>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-subtle)] p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
