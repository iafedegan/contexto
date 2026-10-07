import test from "node:test";
import assert from "node:assert/strict";
import { numeroDelCsv, parsearBibliotecas, parsearCsvGeneral, parsearCsvIndicador, rangoDeMeses } from "@/lib/indicadores-csv";

// Lo que devuelve el origen (la cabecera llega con la «ó» rota por el ISO-8859-1).
const CSV = `064-Precio ganado flaco Kilo en pie - Machos
Fecha;Regi�n Caribe;Magdalena Medio y Santanderes;Llanos Orientales ;
sep/2025;10.197;10.243;9.639;
oct/2025;10.078;10.072;9.643;
ago/2026;10.490;11.438;12.158;
`;
const NOMBRES = ["Región Caribe", "Magdalena Medio y Santanderes", "Llanos Orientales"];

test("los números del origen traen el punto de miles y a veces coma decimal", () => {
  assert.equal(numeroDelCsv("10.490"), 10490);
  assert.equal(numeroDelCsv(" 9.639 "), 9639);
  assert.equal(numeroDelCsv("10,5"), 10.5);
  assert.equal(numeroDelCsv(""), null);
  assert.equal(numeroDelCsv("n/d"), null);
});

test("el CSV se convierte en meses y una serie por columna, con los nombres del catálogo", () => {
  const t = parsearCsvIndicador(CSV, NOMBRES);
  assert.ok(t);
  assert.deepEqual(t.periodos, ["sep/2025", "oct/2025", "ago/2026"]);
  assert.deepEqual(t.series.map((s) => s.nombre), NOMBRES);
  assert.deepEqual(t.series[2].valores, [9639, 9643, 12158]);
});

test("una celda vacía es un hueco (null), no un cero", () => {
  const t = parsearCsvIndicador("Fecha;A;B;\nsep/2025;1.000;;\noct/2025;2.000;3.000;\n", ["A", "B"]);
  assert.ok(t);
  assert.deepEqual(t.series[1].valores, [null, 3000]);
});

test("si no hay al menos dos meses o una serie queda vacía, no se dibuja nada", () => {
  assert.equal(parsearCsvIndicador("", NOMBRES), null);
  assert.equal(parsearCsvIndicador("<html>Error</html>", NOMBRES), null);
  assert.equal(parsearCsvIndicador("Fecha;A;\nsep/2025;1.000;\n", ["A"]), null, "un solo mes no es una tendencia");
  assert.equal(parsearCsvIndicador("Fecha;A;B;\nsep/2025;1.000;;\noct/2025;2.000;;\n", ["A", "B"]), null);
});

test("el rango son los doce meses que terminan en el mes actual de Colombia", () => {
  assert.deepEqual(rangoDeMeses(new Date("2026-10-07T12:00:00Z")), { desde: "01-11-2025", hasta: "31-10-2026" });
  assert.deepEqual(rangoDeMeses(new Date("2026-02-15T12:00:00Z")), { desde: "01-03-2025", hasta: "28-02-2026" });
  // 1 de enero 02:00 UTC todavía es 31 de diciembre en Colombia (UTC−5).
  assert.deepEqual(rangoDeMeses(new Date("2027-01-01T02:00:00Z")), { desde: "01-01-2026", hasta: "31-12-2026" });
});

test("el lector general entiende la forma ancha de los CSV anuales", () => {
  const t = parsearCsvGeneral("001-Inventario total\nFecha;Antioquia;Córdoba;Nacional;\n2001;2.196.342;2.178.988;20.204.979;\n2002;2.262.625;2.263.832;20.477.125;\n");
  assert.ok(t);
  assert.equal(t.titulo, "Inventario total");
  assert.deepEqual(t.periodos, ["2001", "2002"]);
  assert.deepEqual(t.series.map((s) => s.nombre), ["Antioquia", "Córdoba", "Nacional"]);
  assert.deepEqual(t.series[2].valores, [20204979, 20477125]);
});

test("el lector general entiende la forma larga (una serie por fila) y ordena los meses", () => {
  const t = parsearCsvGeneral("014-Precio\n;Fecha;Precio;\nArgentina;feb/2001;0,9;\nBrasil;ene/2001;0,756;\nArgentina;ene/2001;0,833;\nBrasil;feb/2001;0,8;\n");
  assert.ok(t);
  assert.deepEqual(t.periodos, ["ene/2001", "feb/2001"]);
  assert.deepEqual(t.series.find((s) => s.nombre === "Argentina")?.valores, [0.833, 0.9]);
  assert.deepEqual(t.series.find((s) => s.nombre === "Brasil")?.valores, [0.756, 0.8]);
});

test("el lector general ignora el rótulo inicial de la forma ancha con rótulo", () => {
  const t = parsearCsvGeneral("007-Producción mundial\n;Fecha;Argentina;Brasil;\nProducción (1000 Ton);2001;2.640;6.895;\nProducción (1000 Ton);2002;2.700;7.240;\n");
  assert.ok(t);
  assert.deepEqual(t.series.map((s) => s.nombre), ["Argentina", "Brasil"]);
  assert.deepEqual(t.series[1].valores, [6895, 7240]);
});

test("el lector general descarta listados de documentos y cuerpos que no son indicadores", () => {
  assert.equal(parsearCsvGeneral("083-Precios relativos\nFecha;Presentaciones;\ndic/2025;Precios_relativos.pdf;\n"), null);
  assert.equal(parsearCsvGeneral("<html>error</html>"), null);
});

test("las bibliotecas de documentos se leen de las filas que arma la página «General»", () => {
  const html = `<td colspan="100%" class="title" onclick="statShow(29)">036-Coyuntura Ganadera</td>
    <script>tr = document.createElement("tr");td=document.createElement("td");td.className='list';text=document.createTextNode("sep/2021");td.appendChild(text);tr.appendChild(td);td=document.createElement("td");td.className='list';var a=document.createElement("a");a.setAttribute("href","../DOC/download.jsp?pRealName=Coyuntura_Ganadera_Primer_Semestre_2021.pdf&iIdFiles=1003");text=document.createTextNode("x");</script>
    <td class="title">037-Un gráfico sin archivos</td>
    <td colspan="100%" class="title">090-Costos de producción</td>
    <script>td.className='list';text=document.createTextNode("Archivo - 2024");td.appendChild(text);tr.appendChild(td);td=document.createElement("td");td.className='list';var a=document.createElement("a");a.setAttribute("href","../DOC/download.jsp?pRealName=El_Alto_Costo.pdf&iIdFiles=1");</script>`;
  const b = parsearBibliotecas(html, "https://estadisticas.fedegan.org.co/Indicadores/66");
  assert.deepEqual(b.map((x) => [x.codigo, x.titulo, x.documentos.length]), [["036", "Coyuntura Ganadera", 1], ["090", "Costos de producción", 1]]);
  assert.equal(b[0].documentos[0].url, "https://estadisticas.fedegan.org.co/DOC/download.jsp?pRealName=Coyuntura_Ganadera_Primer_Semestre_2021.pdf&iIdFiles=1003");
  assert.equal(b[0].documentos[0].fecha, "sep/2021");
  assert.equal(b[1].documentos[0].fecha, "2024", "«Archivo - 2024» queda en «2024»");
});
