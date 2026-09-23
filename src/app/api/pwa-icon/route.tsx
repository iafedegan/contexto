import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const BRAND = "#1f6d3a";
const BRAND_FG = "#ffffff";

/**
 * Genera los íconos PNG del manifest (192/512, incl. variante "maskable")
 * bajo demanda con next/og, sin depender de assets binarios versionados.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const size = Math.min(Math.max(Number(searchParams.get("size")) || 512, 32), 1024);
  const maskable = searchParams.get("maskable") === "1";
  // El "safe zone" maskable pide ~10% de padding alrededor del contenido.
  const pad = maskable ? Math.round(size * 0.14) : Math.round(size * 0.08);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: size - pad * 2,
            height: size - pad * 2,
            borderRadius: size * 0.18,
            border: `${Math.max(2, Math.round(size * 0.02))}px solid ${BRAND_FG}`,
          }}
        >
          <span
            style={{
              fontSize: (size - pad * 2) * 0.42,
              fontWeight: 800,
              color: BRAND_FG,
              letterSpacing: -2,
              fontFamily: "sans-serif",
            }}
          >
            CG
          </span>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
