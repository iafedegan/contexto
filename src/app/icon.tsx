import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/logo-archivos";

// Tamaño de la imagen generada: 64 px, que el navegador reduce nítida a los 16 o 32 de la pestaña.
export const size = { width: 64, height: 64 };
// Formato de la imagen generada.
export const contentType = "image/png";

// Ícono de la pestaña: el logo del medio dentro de un círculo (como en el sitio); el emblema va un poco más pequeño para que los cuernos no se corten.
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", overflow: "hidden", background: "#f6f8f3" }}>
        {/* next/og no admite next/image: aquí va una <img> a propósito */}
        <img src={logoDataUri("redondeado")} width={Math.round(size.width * 0.84)} height={Math.round(size.height * 0.84)} alt="" />
      </div>
    ),
    { ...size },
  );
}
