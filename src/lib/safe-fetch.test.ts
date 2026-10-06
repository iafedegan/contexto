import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { descargarSeguro, ipPrivada } from "@/lib/safe-fetch";

test("las direcciones privadas, locales y reservadas se reconocen, también en IPv6 y mapeadas (H-05)", () => {
  for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.3.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "198.18.0.1", "0.0.0.0", "224.0.0.1", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.1.2.3", "no-es-una-ip", ""]) {
    assert.equal(ipPrivada(ip), true, `${ip} debe bloquearse`);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111"]) assert.equal(ipPrivada(ip), false, `${ip} es pública`);
});

// Servidor local que sirve una página y redirige a otra.
async function servidor() {
  const srv = createServer((req, res) => {
    if (req.url === "/redirige") {
      res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
      return void res.end();
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<html>hola</html>");
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  return { puerto: (srv.address() as AddressInfo).port, cerrar: () => new Promise<void>((r) => srv.close(() => r())) };
}

test("un servidor en la propia máquina nunca se descarga, ni por IP ni por nombre", async () => {
  const s = await servidor();
  try {
    assert.equal(await descargarSeguro(new URL(`http://127.0.0.1:${s.puerto}/`)), null);
    assert.equal(await descargarSeguro(new URL(`http://localhost:${s.puerto}/`)), null);
    assert.equal(await descargarSeguro(new URL(`http://[::1]:${s.puerto}/`)), null);
    assert.equal(await descargarSeguro(new URL(`http://127.0.0.1:${s.puerto}/redirige`)), null);
  } finally {
    await s.cerrar();
  }
});

test("los esquemas que no son http(s) se rechazan", async () => {
  assert.equal(await descargarSeguro(new URL("file:///etc/passwd")), null);
  assert.equal(await descargarSeguro(new URL("ftp://example.com/x")), null);
});
