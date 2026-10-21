import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { logoDataUri } from "@/lib/logo-archivos";

/**
 * Genera los íconos PNG del manifest (192/512, incl. variante "maskable")
 * bajo demanda con next/og, sin depender de assets binarios versionados.
 *
 *  - «any»: el emblema dentro de un CÍRCULO del tono claro de la baldosa, con las esquinas transparentes (igual que el logo del sitio y el ícono
 *    de la pestaña); el emblema va un poco más pequeño para que las puntas de los cuernos no se corten.
 *  - «maskable»: cuadrado a sangre con el emblema dentro de la zona segura (el 80 % central), porque el sistema
 *    recorta el ícono con su propia máscara (círculo, gota, cuadrado redondeado…).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const size = Math.min(Math.max(Number(searchParams.get("size")) || 512, 32), 1024);
  const maskable = searchParams.get("maskable") === "1";
  const logo = logoDataUri(maskable ? "maskable" : "redondeado");

  return new ImageResponse(
    maskable ? (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og no admite next/image */}
        <img src={logo} width={size} height={size} alt="" />
      </div>
    ) : (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", overflow: "hidden", background: "#f6f8f3" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og no admite next/image */}
        <img src={logo} width={Math.round(size * 0.84)} height={Math.round(size * 0.84)} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
