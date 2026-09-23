import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const BRAND = "#1f6d3a";
const BRAND_FG = "#ffffff";

export default function AppleIcon() {
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
        <span
          style={{
            fontSize: 84,
            fontWeight: 800,
            color: BRAND_FG,
            letterSpacing: -2,
            fontFamily: "sans-serif",
          }}
        >
          CG
        </span>
      </div>
    ),
    { ...size },
  );
}
