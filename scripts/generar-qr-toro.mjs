// Genera el QR que lleva a /toro-ar (SVG para imprimir + PNG). Uso: node scripts/generar-qr-toro.mjs [url-base]
import QRCode from "qrcode";
import { writeFileSync } from "node:fs";

const base = (process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://contexto-olive.vercel.app").replace(/\/$/, "");
const url = `${base}/toro-ar?utm_source=qr`;
const opts = { errorCorrectionLevel: "M", margin: 2, color: { dark: "#101611", light: "#ffffff" } };

writeFileSync("public/qr/toro-ar.svg", await QRCode.toString(url, { ...opts, type: "svg" }));
await QRCode.toFile("public/qr/toro-ar.png", url, { ...opts, width: 1024 });
console.log("QR →", url);
