import { ImageResponse } from "next/og";
import { getMinForTopCents, getTopListing } from "@/lib/ranking";
import { fmtUSD } from "@/lib/format";

export const dynamic = "force-dynamic";
export const alt = "Mythic Bid — Rank is the bid.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Live OG image: shows the current price of #1. */
export default async function OpengraphImage() {
  const top = getTopListing();
  const price = fmtUSD(getMinForTopCents());

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
          background: "#0a0a0c",
          backgroundImage:
            "radial-gradient(circle at 50% 120%, rgba(226,182,91,0.14), rgba(226,182,91,0) 55%)",
          color: "#f4f4f5",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#E2B65B",
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 10,
              gap: 5,
            }}
          >
            <div style={{ width: 8, height: 14, borderRadius: 2, background: "#17120A" }} />
            <div style={{ width: 8, height: 24, borderRadius: 2, background: "#17120A" }} />
            <div style={{ width: 8, height: 34, borderRadius: 2, background: "#17120A" }} />
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              letterSpacing: -1,
              display: "flex",
              alignItems: "center",
            }}
          >
            Mythic<span style={{ color: "#E2B65B" }}>Bid</span>
          </div>
        </div>

        <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3 }}>
          Rank is the bid.
        </div>
        <div style={{ marginTop: 22, fontSize: 34, color: "#9d9da8" }}>
          The paid leaderboard — no ads, no algorithms.
        </div>
        <div
          style={{
            marginTop: 48,
            display: "flex",
            alignItems: "center",
            gap: 14,
            border: "1px solid rgba(226,182,91,0.4)",
            borderRadius: 999,
            padding: "14px 34px",
          }}
        >
          <span style={{ fontSize: 30, color: "#F2CD7E", fontWeight: 600 }}>
            {top ? `Claim #1 for ${price}` : `Start the board for ${price}`}
          </span>
        </div>
      </div>
    ),
    size
  );
}
