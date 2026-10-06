import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Archivos de código de una carpeta, sin pruebas ni definiciones de tipos generadas.
function codigo(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "node_modules" || n === ".next" ? [] : codigo(p);
    return /\.(ts|tsx)$/.test(n) && !/\.d\.ts$|\.test\.ts$/.test(n) ? [p] : [];
  });
}

test("todo archivo de src trae una descripción de lo que hace (H-24)", () => {
  const sin = codigo("src").filter((archivo) => {
    const inicio = readFileSync(archivo, "utf8").split("\n").slice(0, 80).join("\n");
    const comentarios = [...inicio.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g)]
      .map((m) => m[0])
      .filter((c) => !/eslint|@ts-|use client|use server/.test(c));
    return !comentarios.some((c) => c.replace(/[/*\s]+/g, " ").trim().length >= 25);
  });
  assert.deepEqual(sin, [], `Archivos sin descripción (añade un comentario que diga qué hacen y por qué):\n${sin.join("\n")}`);
});

test("el código no habla de archivos que ya no existen", () => {
  // Rutas que el código cita en sus comentarios y que se eliminaron o se renombraron (H-24): `middleware.ts` es hoy `proxy.ts`.
  const desactualizados: string[] = [];
  for (const archivo of [...codigo("src"), "next.config.ts"]) {
    const texto = readFileSync(archivo, "utf8");
    if (/middleware\.ts/.test(texto) && !existsSync("src/middleware.ts")) desactualizados.push(`${archivo}: cita middleware.ts (hoy es src/proxy.ts)`);
    if (/api\/redirects/.test(texto) && !existsSync("src/app/api/redirects/route.ts")) desactualizados.push(`${archivo}: cita /api/redirects, que ya no existe`);
  }
  assert.deepEqual(desactualizados, []);
});
