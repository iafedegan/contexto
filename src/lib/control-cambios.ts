/**
 * Control de cambios de una nota, como en Word: compara las versiones que se guardan cada vez que la nota pasa de una persona a otra y marca,
 * sobre el texto actual, qué agregó y qué quitó cada persona. Sin base de datos ni dependencias (para probarlo y usarlo en el navegador o el
 * servidor). Trabaja con el HTML del cuerpo partido en piezas (etiquetas, palabras, espacios y signos): las etiquetas no se marcan, así el HTML
 * que sale sigue bien formado.
 */
export type Pieza = { t: string; autor: string | null; borradoPor?: string; etiqueta: boolean };
export type Version = { html: string; autor: string; /** Versión que deshace un cambio (rechazo): lo que quita no deja rastro y lo que vuelve recupera su marca original. */ limpia?: boolean };

// Cada palabra o signo lleva pegados los espacios que le siguen: así un espacio nunca es un cambio por sí solo (partía los cambios en pedazos).
const RE = /(<[^>]+>)|([\p{L}\p{N}]+\s*)|([^\s<\p{L}\p{N}]\s*)|(\s+)/gu;
/** Qué se compara de cada pieza: sin los espacios del final (cambiar solo un espacio no es un cambio). */
const clave = (t: string) => (t.startsWith("<") ? t : t.trimEnd() || " ");

export function trocear(html: string): string[] {
  return html.match(RE) ?? [];
}

type Op = { tipo: "igual" | "quita" | "pone"; a?: number; b?: number };

/** Diferencias entre dos listas de piezas (algoritmo de Myers, O((N+M)·D)). Devuelve las operaciones en orden. */
export function diferencias(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const v = new Map<number, number>([[1, 0]]);
  const trazas: Map<number, number>[] = [];
  let fin = false;
  for (let d = 0; d <= max && !fin; d++) {
    trazas.push(new Map(v));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1)) ? (v.get(k + 1) ?? 0) : (v.get(k - 1) ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && clave(a[x]) === clave(b[y])) {
        x++;
        y++;
      }
      v.set(k, x);
      if (x >= n && y >= m) {
        fin = true;
        break;
      }
    }
  }
  // Se reconstruye el camino de atrás hacia adelante.
  const ops: Op[] = [];
  let x = n;
  let y = m;
  for (let d = trazas.length - 1; d >= 0 && (x > 0 || y > 0); d--) {
    const vv = trazas[d];
    const k = x - y;
    const vaArriba = k === -d || (k !== d && (vv.get(k - 1) ?? -1) < (vv.get(k + 1) ?? -1));
    const kPrev = vaArriba ? k + 1 : k - 1;
    const xPrev = vv.get(kPrev) ?? 0;
    const yPrev = xPrev - kPrev;
    while (x > xPrev && y > yPrev) {
      ops.push({ tipo: "igual", a: x - 1, b: y - 1 });
      x--;
      y--;
    }
    if (d > 0) {
      if (x === xPrev) ops.push({ tipo: "pone", b: y - 1 });
      else ops.push({ tipo: "quita", a: x - 1 });
    }
    x = xPrev;
    y = yPrev;
  }
  while (x > 0 && y > 0) {
    ops.push({ tipo: "igual", a: x - 1, b: y - 1 });
    x--;
    y--;
  }
  while (x > 0) ops.push({ tipo: "quita", a: --x });
  while (y > 0) ops.push({ tipo: "pone", b: --y });
  return ops.reverse();
}

const esEtiqueta = (t: string) => t.startsWith("<");

/**
 * Recorre las versiones en orden y deja, sobre la última, quién puso cada palabra y qué se borró (y quién). La primera versión es la base (sin
 * autor). Lo que alguien agrega y él mismo borra después desaparece sin dejar rastro, como en Word.
 */
export function atribuir(versiones: Version[]): Pieza[] {
  if (!versiones.length) return [];
  let piezas: Pieza[] = trocear(versiones[0].html).map((t) => ({ t, autor: null, etiqueta: esEtiqueta(t) }));
  for (let i = 1; i < versiones.length; i++) {
    const { html, autor, limpia } = versiones[i];
    const visibles = piezas.filter((p) => !p.borradoPor);
    const nuevas = trocear(html);
    const ops = diferencias(visibles.map((p) => p.t), nuevas);
    const salida: Pieza[] = [];
    let cursor = 0; // posición en `piezas`
    const avanzarBorradas = () => {
      while (cursor < piezas.length && piezas[cursor].borradoPor) salida.push(piezas[cursor++]);
    };
    for (const op of ops) {
      if (op.tipo === "pone") {
        const t = nuevas[op.b!];
        // Al rechazar un borrado, el texto vuelve: se recupera la pieza borrada (con su autor original) en vez de marcarla como nueva.
        if (limpia && cursor < piezas.length && piezas[cursor].borradoPor && clave(piezas[cursor].t) === clave(t)) {
          const { borradoPor, ...p } = piezas[cursor++];
          void borradoPor;
          salida.push(p);
          continue;
        }
        salida.push({ t, autor: limpia ? null : autor, etiqueta: esEtiqueta(t) });
        continue;
      }
      avanzarBorradas();
      const p = piezas[cursor++];
      if (op.tipo === "igual") salida.push({ ...p, t: nuevas[op.b!] });
      // Borrada: si la había puesto esta misma persona, se va sin rastro; las etiquetas borradas tampoco se guardan (romperían el HTML).
      // Un espacio borrado no se marca (solo partiría en dos un cambio de varias palabras).
      else if (!limpia && !p.etiqueta && !/^\s+$/.test(p.t) && p.autor !== autor) salida.push({ ...p, borradoPor: autor });
    }
    avanzarBorradas();
    piezas = salida;
  }
  return piezas;
}

export type Cambio = { id: number; tipo: "pone" | "quita"; autor: string; texto: string };

/** Agrupa las piezas marcadas contiguas del mismo autor y tipo en cambios numerados (los espacios entre palabras del mismo cambio van dentro). */
export function cambiosDe(piezas: Pieza[]): { cambio: (number | null)[]; lista: Cambio[] } {
  const cambio: (number | null)[] = piezas.map(() => null);
  const lista: Cambio[] = [];
  let actual: Cambio | null = null;
  const claveDe = (p: Pieza) => (p.etiqueta ? null : p.borradoPor ? `q:${p.borradoPor}` : p.autor ? `p:${p.autor}` : null);
  for (let i = 0; i < piezas.length; i++) {
    const p = piezas[i];
    let clave: string | null = claveDe(p);
    // Un espacio entre dos piezas del mismo cambio pertenece a ese cambio.
    if (!clave && /^\s+$/.test(p.t) && actual) {
      const sig = piezas.slice(i + 1).find((x) => !/^\s+$/.test(x.t));
      if (sig && claveDe(sig) === `${actual.tipo === "pone" ? "p" : "q"}:${actual.autor}`) clave = `${actual.tipo === "pone" ? "p" : "q"}:${actual.autor}`;
    }
    if (!clave) {
      actual = null;
      continue;
    }
    const tipo: Cambio["tipo"] = clave.startsWith("p:") ? "pone" : "quita";
    const autor = clave.slice(2);
    if (!actual || actual.tipo !== tipo || actual.autor !== autor) {
      actual = { id: lista.length, tipo, autor, texto: "" };
      lista.push(actual);
    }
    actual.texto += p.t;
    cambio[i] = actual.id;
  }
  return { cambio, lista };
}

const esc = (t: string) => t.replace(/&(?![a-z#0-9]+;)/gi, "&amp;");

/** HTML del texto actual con los cambios marcados: `<ins>` y `<del>` con el número del cambio y el número de la persona (para su color). */
export function marcar(piezas: Pieza[], personas: string[]): { html: string; lista: Cambio[] } {
  const { cambio, lista } = cambiosDe(piezas);
  let html = "";
  let abierto: number | null = null;
  const cerrar = () => {
    if (abierto !== null) html += lista[abierto].tipo === "pone" ? "</ins>" : "</del>";
    abierto = null;
  };
  for (let i = 0; i < piezas.length; i++) {
    const p = piezas[i];
    const c = cambio[i];
    if (p.etiqueta) {
      cerrar();
      html += p.t;
      continue;
    }
    if (c !== abierto) {
      cerrar();
      if (c !== null) {
        const k = lista[c];
        const n = Math.max(0, personas.indexOf(k.autor));
        if (k.tipo === "quita" && html && !/[\s>]$/.test(html)) html += " ";
        html += k.tipo === "pone" ? `<ins class="cc-pone" data-cambio="${c}" data-persona="${n}">` : `<del class="cc-quita" data-cambio="${c}" data-persona="${n}">`;
        abierto = c;
      }
    }
    html += esc(p.t);
  }
  cerrar();
  return { html, lista };
}

/** El HTML actual con UN cambio deshecho: si era algo que alguien puso, se quita; si era algo que se borró, vuelve. */
export function rechazar(piezas: Pieza[], idCambio: number): string {
  const { cambio, lista } = cambiosDe(piezas);
  const k = lista[idCambio];
  if (!k) return actual(piezas);
  let html = "";
  piezas.forEach((p, i) => {
    const vuelve = cambio[i] === idCambio && k.tipo === "quita";
    if (cambio[i] === idCambio ? !vuelve : p.borradoPor) return;
    // El texto que vuelve necesita su espacio si la pieza anterior ya no lo tiene.
    if (vuelve && /^[\p{L}\p{N}]/u.test(p.t) && html && !/[\s>]$/.test(html)) html += " ";
    html += p.t;
  });
  return html;
}

/** El HTML actual, sin marcas (lo visible). */
export const actual = (piezas: Pieza[]) => piezas.filter((p) => !p.borradoPor).map((p) => p.t).join("");
