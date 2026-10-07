import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/logo-archivos";

// Tamaño de la imagen generada.
export const size = { width: 180, height: 180 };
// Formato de la imagen generada.
export const contentType = "image/png";

// Ícono de iOS: cuadrado a sangre (iOS le pone su propia máscara de esquinas).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* next/og no admite next/image: aquí va una <img> a propósito */}
        <img src={logoDataUri("ios")} width={size.width} height={size.height} alt="" />
      </div>
    ),
    { ...size },
  );
}
