"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { FaviconTile } from "@/components/board-section";
import { fmtCountdown, fmtUSD } from "@/lib/format";
import type { TakeoverInfo } from "@/lib/types";

/**
 * The paid front-page spotlight. Pinned above the board while a takeover is
 * active; shows a live countdown until the lock expires.
 */
export function TakeoverSpotlight({
  takeover,
}: {
  takeover: TakeoverInfo | null;
}) {
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!takeover) return null;

  const remaining = takeover.endsAt - nowTick;
  const expired = remaining <= 0;
  if (expired) return null;

  return (
    <div className="gold-frame rise-in" role="region" aria-label="Front-page takeover">
      <a
        href={`/go/${takeover.listingId}`}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        className="group flex items-center gap-4 rounded-[15px] bg-panel px-5 py-4"
      >
        <FaviconTile
          name={takeover.name}
          host={takeover.host ?? "x.com"}
          size={40}
        />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-gold">
            <Crown size={12} aria-hidden="true" />
            Front-page takeover
          </p>
          <p className="mt-0.5 truncate text-[15px] font-semibold text-ink">
            {takeover.name}
            <span className="ml-2 text-xs font-normal text-dim">
              {takeover.handle ?? takeover.host}
            </span>
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="num text-[13px] font-semibold text-gold-strong tabular-nums">
            {fmtCountdown(remaining)}
          </p>
          <p className="num text-[11px] text-dim">{fmtUSD(takeover.priceCents)} · locked</p>
        </div>
      </a>
    </div>
  );
}
