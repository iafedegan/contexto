import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const BRAND = "#1f6d3a";
const BRAND_FG = "#ffffff";

export default function Icon() {
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
          borderRadius: 6,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 800, color: BRAND_FG, fontFamily: "sans-serif" }}>
          CG
        </span>
      </div>
    ),
    { ...size },
  );
}
