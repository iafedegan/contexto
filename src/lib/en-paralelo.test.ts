import test from "node:test";
import assert from "node:assert/strict";
import { limitador } from "@/lib/en-paralelo";

const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

test("el limitador nunca deja más tareas en marcha que el tope y las termina todas", async () => {
  const ejecutar = limitador(3);
  let enMarcha = 0;
  let pico = 0;
  const resultados = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      ejecutar(async () => {
        enMarcha++;
        pico = Math.max(pico, enMarcha);
        await pausa(5 + (i % 3) * 4);
        enMarcha--;
        return i * 2;
      }),
    ),
  );
  assert.equal(pico, 3);
  assert.deepEqual(resultados, Array.from({ length: 12 }, (_, i) => i * 2));
});

test("las tareas empiezan en orden de llegada", async () => {
  const ejecutar = limitador(2);
  const orden: number[] = [];
  await Promise.all(
    [0, 1, 2, 3, 4].map((i) =>
      ejecutar(async () => {
        orden.push(i);
        await pausa(3);
      }),
    ),
  );
  assert.deepEqual(orden, [0, 1, 2, 3, 4]);
});

test("una tarea que falla libera su cupo y no frena a las demás", async () => {
  const ejecutar = limitador(1);
  const fallida = ejecutar(async () => {
    throw new Error("falla");
  });
  const siguiente = ejecutar(async () => "sigue");
  await assert.rejects(fallida, /falla/);
  assert.equal(await siguiente, "sigue");
});

test("un tope inválido se trata como uno", async () => {
  const ejecutar = limitador(0);
  let enMarcha = 0;
  let pico = 0;
  await Promise.all(
    [1, 2, 3].map(() =>
      ejecutar(async () => {
        enMarcha++;
        pico = Math.max(pico, enMarcha);
        await pausa(2);
        enMarcha--;
      }),
    ),
  );
  assert.equal(pico, 1);
});
