import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const LOGO_DATA_URL = `data:image/jpeg;base64,${readFileSync(
  join(process.cwd(), "public/logo/contexto-ganadero-logo.jpg"),
).toString("base64")}`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og no admite next/image */}
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
