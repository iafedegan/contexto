import test from "node:test";
import assert from "node:assert/strict";
import { ajustarPooler } from "./pooler";

const pooler = "postgresql://postgres.abc:Clave123@aws-0-us-east-2.pooler.supabase.com:5432/postgres";

test("el pooler de Supabase en modo sesión pasa al puerto de transacción", () => {
  assert.equal(ajustarPooler(pooler, undefined), "postgresql://postgres.abc:Clave123@aws-0-us-east-2.pooler.supabase.com:6543/postgres");
  assert.equal(ajustarPooler(`${pooler}?sslmode=require`, undefined), "postgresql://postgres.abc:Clave123@aws-0-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require");
});

test("no toca lo que no es el pooler, ni lo que ya está en 6543, ni cuando se pide modo sesión", () => {
  const directa = "postgresql://postgres:Clave123@db.abc.supabase.co:5432/postgres";
  const local = "postgresql://u:p@localhost:5432/db";
  const yaTransaccion = "postgresql://postgres.abc:Clave123@aws-0-us-east-2.pooler.supabase.com:6543/postgres";
  assert.equal(ajustarPooler(directa, undefined), directa);
  assert.equal(ajustarPooler(local, undefined), local);
  assert.equal(ajustarPooler(yaTransaccion, undefined), yaTransaccion);
  assert.equal(ajustarPooler(pooler, "session"), pooler);
});

test("una contraseña con ':5432' o '@' no engaña a la sustitución", () => {
  const rara = "postgresql://postgres.abc:a%405432@aws-0-us-east-2.pooler.supabase.com:5432/postgres";
  assert.equal(ajustarPooler(rara, undefined), "postgresql://postgres.abc:a%405432@aws-0-us-east-2.pooler.supabase.com:6543/postgres");
});
