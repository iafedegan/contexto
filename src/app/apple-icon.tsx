import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Se ejecuta en Node.js, que necesita para leer el logo del disco.
export const runtime = "nodejs";
// Tamaño de la imagen generada.
export const size = { width: 180, height: 180 };
// Formato de la imagen generada.
export const contentType = "image/png";

// Logo en base64 para incrustarlo en la imagen.
const LOGO_DATA_URL = `data:image/jpeg;base64,${readFileSync(
  join(process.cwd(), "public/logo/contexto-ganadero-logo.jpg"),
).toString("base64")}`;

// Ícono de iOS generado con el logo del medio.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* next/og no admite next/image: aquí va una <img> a propósito */}
        <img
          src={LOGO_DATA_URL}
          width={size.width}
          height={size.height}
          style={{ objectFit: "cover" }}
          alt=""
        />
      </div>
    ),
    { ...size },
  );
}
