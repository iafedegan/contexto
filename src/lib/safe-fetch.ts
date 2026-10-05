import "server-only";
import { lookup as dnsLookup } from "node:dns";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

/**
 * Descarga de páginas ajenas (enlaces que pega la redacción) sin que el servidor pueda ser usado
 * para llegar a su red interna (SSRF).
 *
 * Tres defensas que `fetch` por sí solo no da:
 *  1. El DNS se resuelve DENTRO de la conexión (`lookup` propio): la IP que se valida es la misma a la
 *     que se conecta, así un dominio que cambia de IP entre la comprobación y la petición (DNS rebinding)
 *     no sirve.
 *  2. Las redirecciones se siguen a mano y cada salto pasa por las mismas comprobaciones; un enlace
 *     público que redirige a `http://169.254.169.254/` o a `localhost` se rechaza.
 *  3. El cuerpo se lee por flujo con un tope de bytes, en vez de descargarlo entero.
 */

/** Rangos que nunca son un sitio público: loopback, redes privadas, enlace local, CGNAT, multicast, reservados. */
const BLOQUEADAS = new BlockList();
for (const [ip, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  BLOQUEADAS.addSubnet(ip, bits, "ipv4");
}
for (const [ip, bits] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  BLOQUEADAS.addSubnet(ip, bits, "ipv6");
}

/** `true` si la dirección es privada, reservada o no es una IP válida (ante la duda, se bloquea). */
export function ipPrivada(ip: string): boolean {
  const version = isIP(ip);
  if (!version) return true;
  // BlockList entiende las direcciones IPv4 mapeadas en IPv6 (::ffff:10.0.0.1 y ::ffff:a00:1).
  return BLOQUEADAS.check(ip, version === 6 ? "ipv6" : "ipv4");
}

type Direccion = { address: string; family: number };

/** `lookup` de la conexión: resuelve y rechaza si CUALQUIER respuesta apunta a una red no pública. */
function lookupSeguro(
  hostname: string,
  opciones: { all?: boolean },
  cb: (err: Error | null, address?: string | Direccion[], family?: number) => void,
) {
  dnsLookup(hostname, { all: true }, (err, direcciones) => {
    if (err) return cb(err);
    if (!direcciones.length || direcciones.some((d) => ipPrivada(d.address))) {
      return cb(new Error("Destino no permitido."));
    }
    if (opciones.all) return cb(null, direcciones);
    return cb(null, direcciones[0].address, direcciones[0].family);
  });
}

export type RespuestaSegura = { status: number; tipo: string; cuerpo: string; url: URL };

type Salto = { status: number; tipo: string; location: string | null; cuerpo: string };

/** Una sola petición GET, sin seguir redirecciones. */
function pedir(url: URL, maxBytes: number, cabeceras: Record<string, string>): Promise<Salto> {
  return new Promise((resolve, reject) => {
    // Una IP escrita directamente en la URL no pasa por `lookup`: se comprueba aquí.
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) && ipPrivada(host)) return reject(new Error("Destino no permitido."));

    const pedido = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      // `lookup` propio: ver arriba. El tipo de Node espera la firma completa, de ahí la conversión.
      { method: "GET", lookup: lookupSeguro as never, headers: { ...cabeceras, "accept-encoding": "identity" } },
      (res) => {
        const status = res.statusCode ?? 0;
        const tipo = String(res.headers["content-type"] ?? "");
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, tipo, location, cuerpo: "" });
        }
        const partes: Buffer[] = [];
        let total = 0;
        let cerrado = false;
        const fin = () => {
          if (cerrado) return;
          cerrado = true;
          resolve({ status, tipo, location, cuerpo: Buffer.concat(partes).toString("utf8") });
        };
        res.on("data", (trozo: Buffer) => {
          total += trozo.length;
          if (total > maxBytes) {
            partes.push(trozo.subarray(0, trozo.length - (total - maxBytes)));
            res.destroy();
          } else {
            partes.push(trozo);
          }
        });
        res.on("end", fin);
        res.on("close", fin);
        res.on("error", fin);
      },
    );
    pedido.setTimeout(10_000, () => pedido.destroy(new Error("Tiempo agotado.")));
    pedido.on("error", reject);
    pedido.end();
  });
}

/**
 * Descarga una página pública. Devuelve `null` si el destino no es público o no responde, si hay más
 * de 4 redirecciones, si el esquema no es http(s) o si la respuesta no es 2xx.
 */
export async function descargarSeguro(
  inicial: URL,
  opciones: { maxBytes?: number; cabeceras?: Record<string, string> } = {},
): Promise<RespuestaSegura | null> {
  const maxBytes = opciones.maxBytes ?? 2_000_000;
  let url = inicial;
  for (let salto = 0; salto <= 4; salto++) {
    if (!/^https?:$/.test(url.protocol)) return null;
    let r: Salto;
    try {
      r = await pedir(url, maxBytes, opciones.cabeceras ?? {});
    } catch {
      // Destino no permitido, DNS que no resuelve, conexión rechazada o tiempo agotado.
      return null;
    }
    if (r.status >= 300 && r.status < 400) {
      if (!r.location) return null;
      url = new URL(r.location, url);
      continue;
    }
    return r.status >= 200 && r.status < 300 ? { status: r.status, tipo: r.tipo, cuerpo: r.cuerpo, url } : null;
  }
  return null;
}
