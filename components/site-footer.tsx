"use client";

import Link from "next/link";
import { useLiveState } from "@/components/live-state-provider";
import { useCountUp } from "@/components/use-count-up";
import { relTime } from "@/lib/format";

export function SiteFooter() {
  const { state } = useLiveState();
  const revenueUsd = state ? Math.round(state.stats.revenueCents / 100) : 0;
  const animated = useCountUp(revenueUsd);

  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <p className="text-center text-sm text-mute">
          This experiment has made{" "}
          <span className="num font-semibold text-gold-strong">
            ${animated.toLocaleString("en-US")}
          </span>{" "}
          since its launch{" "}
          {state ? relTime(state.stats.launchAt, state.now) : "—"}.
        </p>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 sm:flex-row">
          <nav
            className="flex items-center gap-5 text-[13px]"
            aria-label="Footer"
          >
            <Link href="/rules" className="link-quiet">
              Rules
            </Link>
            <Link href="/about" className="link-quiet">
              About
            </Link>
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="link-quiet"
            >
              X / Twitter
            </a>
          </nav>
          <p className="text-xs text-dim">
            Demo payments enabled — no real cards are charged. © 2026 Mythic Bid
          </p>
        </div>
      </div>
    </footer>
  );
}
