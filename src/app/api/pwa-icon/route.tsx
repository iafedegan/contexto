import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { logoDataUri } from "@/lib/logo";

/**
 * Genera los íconos PNG del manifest (192/512, incl. variante "maskable")
 * bajo demanda con next/og, sin depender de assets binarios versionados.
 *
 *  - «any»: la baldosa redondeada tal cual, con las esquinas transparentes.
 *  - «maskable»: cuadrado a sangre con las letras dentro de la zona segura (el 80 % central), porque el sistema
 *    recorta el ícono con su propia máscara (círculo, gota, cuadrado redondeado…).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const size = Math.min(Math.max(Number(searchParams.get("size")) || 512, 32), 1024);
  const maskable = searchParams.get("maskable") === "1";
  const logo = logoDataUri(maskable ? { fondo: "completo", escala: 0.78 } : {});

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og no admite next/image */}
        <img src={logo} width={size} height={size} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
