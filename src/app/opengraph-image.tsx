import { ImageResponse } from "next/og";

export const alt = "Radio Night: an interactive radio mystery";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Share card for links to the home page. Text only, so it spoils nothing. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          background: "radial-gradient(ellipse at 50% 60%, #4a2508 0%, #1c1917 65%)",
          color: "#f5f5f4",
          fontFamily: "serif",
        }}
      >
        <div style={{ fontSize: 26, letterSpacing: 10, color: "#d97706", textTransform: "uppercase" }}>
          A Radio Mystery
        </div>
        <div style={{ fontSize: 132, fontWeight: 700 }}>Radio Night</div>
        <div style={{ fontSize: 38, fontStyle: "italic", color: "#a8a29e" }}>The story is listening.</div>
        <div style={{ fontSize: 24, color: "#78716c", marginTop: 16 }}>Millhaven, New Hampshire. October 1981.</div>
      </div>
    ),
    size,
  );
}
