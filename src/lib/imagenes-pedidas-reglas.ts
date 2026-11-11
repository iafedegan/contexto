/**
 * Imágenes de portada que un redactor o un editor le pide al diseñador. Reglas puras, sin servidor ni base, para poder probarlas
 * y usarlas también en el navegador.
 */
export type EstadoPedido = "pendiente" | "entregada" | "cancelada";

export type PedidoImagen = {
  articleId: string;
  /** Quien lo pidió. */
  porId: string;
  /** Diseñador al que se le pidió; sin valor, cualquier diseñador puede tomarlo. */
  disenadorId: string | null;
  indicaciones: string;
  estado: EstadoPedido;
  fecha: string;
  entregadaEn?: string;
  entregadaPorId?: string;
  /** La imagen que entregó el diseñador. */
  url?: string;
  /** Texto alternativo y pie de foto (con el crédito) que escribió al entregarla: pasan a la nota junto con la imagen. */
  alt?: string;
  pie?: string;
};

/** Quien puede entregar la imagen pedida: los diseñadores, y los editores y administradores que los reemplazan. */
export const puedeEntregarImagen = (role: string) => role === "disenador" || role === "editor" || role === "administrador";

/** El pedido de una nota (hay uno solo por nota: pedir otra vez reemplaza al anterior). */
export const pedidoDeNota = (lista: PedidoImagen[], articleId: string): PedidoImagen | null => lista.find((p) => p.articleId === articleId) ?? null;

/** Los pedidos que un diseñador debe atender: los dirigidos a él y los abiertos a cualquiera. Editores y administradores ven todos los pendientes. */
export function pendientesPara(lista: PedidoImagen[], userId: string, role: string): PedidoImagen[] {
  return lista
    .filter((p) => p.estado === "pendiente")
    .filter((p) => role !== "disenador" || p.disenadorId === null || p.disenadorId === userId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Una dirección de imagen aceptable para la portada: https y de largo razonable. */
export const urlDeImagenValida = (u: string) => u.length <= 2000 && /^https:\/\/\S+$/.test(u);
