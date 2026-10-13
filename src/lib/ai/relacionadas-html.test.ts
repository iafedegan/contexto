import test from "node:test";
import assert from "node:assert/strict";
import { aplicarRelacionadas, bloqueRelacionadas, contarRemisionesMuertas, limpiarRemisiones } from "@/lib/ai/relacionadas-html";

// Cuerpo real de una nota publicada: tres remisiones con enlace «#».
const REAL = `<p>El plan proyecta beneficiar a 100.000 pequeños ganaderos. (Lea en CONtexto ganadero : <a href="#">La ganadería regenerativa se consolida como alternativa frente al cambio climático</a>)</p>
<p>Este convenio bilateral establece la asistencia técnica.</p>
<ul>
<li><a href="#">Lea en CONtexto ganadero : Herramientas tecnológicas para la toma de decisiones en predios ganaderos</a></li>
<li><a href="#">Lea en CONtexto ganadero : Los retos del cambio climático para el pequeño productor agropecuario</a></li>
</ul>`;

test("las remisiones con enlace «#» se quitan y el resto de la nota queda intacta", () => {
  assert.equal(contarRemisionesMuertas(REAL), 3);
  const limpio = limpiarRemisiones(REAL);
  assert.doesNotMatch(limpio, /Lea en CONtexto/);
  assert.doesNotMatch(limpio, /href="#"/);
  assert.doesNotMatch(limpio, /<ul>/);
  assert.match(limpio, /beneficiar a 100\.000 pequeños ganaderos\.<\/p>/);
  assert.match(limpio, /Este convenio bilateral/);
});

test("las remisiones con enlace real no se tocan; los enlaces muertos sueltos quedan como texto", () => {
  const vivo = `<p>Texto. (Lea en CONtexto ganadero: <a href="/articulo/otra-nota">Otra nota</a>)</p><p>Ver <a href="#">aquí</a> y <a href="mailto:a@b.co">escribir</a>.</p>`;
  const limpio = limpiarRemisiones(vivo);
  assert.match(limpio, /<a href="\/articulo\/otra-nota">Otra nota<\/a>/);
  assert.match(limpio, /Ver aquí y <a href="mailto:a@b\.co">escribir<\/a>\./);
  assert.equal(contarRemisionesMuertas(vivo), 0);
});

test("las notas relacionadas se insertan antes de las fuentes, con enlace real, y al repetir no se duplican", () => {
  const notas = [
    { title: "Ganadería «regenerativa» & clima", url: "/articulo/regenerativa-clima" },
    { title: "Casanare", url: "https://www.contextoganadero.com/ganaderia/casanare" },
  ];
  const cuerpo = `${REAL}<details><summary>Fuentes consultadas (1)</summary><ul><li><a href="https://fao.org">FAO</a></li></ul></details>`;
  const uno = aplicarRelacionadas(cuerpo, notas);
  assert.match(uno, /<div class="lx-relacionadas"><p>Lea en CONtexto ganadero: <a href="\/articulo\/regenerativa-clima">Ganadería «regenerativa» &amp; clima<\/a><\/p>/);
  assert.ok(uno.indexOf("lx-relacionadas") < uno.indexOf("<details"), "va antes de las fuentes");
  assert.doesNotMatch(uno, /href="#"/);
  const dos = aplicarRelacionadas(uno, notas);
  assert.equal(dos, uno, "aplicar dos veces da lo mismo");
  assert.equal((dos.match(/lx-relacionadas/g) ?? []).length, 1);
  // Sin notas solo limpia, y reemplazar por otras quita las anteriores.
  assert.doesNotMatch(aplicarRelacionadas(uno, []), /lx-relacionadas/);
  assert.doesNotMatch(aplicarRelacionadas(uno, [{ title: "Otra", url: "/articulo/otra" }]), /regenerativa-clima/);
  assert.equal(bloqueRelacionadas([]), "");
});

test("si el editor perdió el recuadro, la línea suelta de una nota ya enlazada no se duplica", () => {
  const notas = [{ title: "Casanare", url: "/articulo/casanare" }];
  const sinRecuadro = `<p>Texto.</p><p>Lea en CONtexto ganadero: <a href="/articulo/casanare">Casanare</a></p>`;
  const r = aplicarRelacionadas(sinRecuadro, notas);
  assert.equal((r.match(/\/articulo\/casanare/g) ?? []).length, 1);
  assert.match(r, /lx-relacionadas/);
});
