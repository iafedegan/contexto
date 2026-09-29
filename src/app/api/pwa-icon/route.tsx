import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const BRAND = "#1f6d3a";
const BRAND_FG = "#ffffff";

const LOGO_DATA_URL = `data:image/jpeg;base64,${readFileSync(
  join(process.cwd(), "public/logo/contexto-ganadero-logo.jpg"),
).toString("base64")}`;

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
            width: size - pad * 2,
            height: size - pad * 2,
            borderRadius: size * 0.18,
            border: `${Math.max(2, Math.round(size * 0.02))}px solid ${BRAND_FG}`,
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og no admite next/image */}
          <img
            src={LOGO_DATA_URL}
            width={size - pad * 2}
            height={size - pad * 2}
            style={{ objectFit: "cover" }}
            alt=""
          />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
