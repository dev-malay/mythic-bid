"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { useLiveState } from "@/components/live-state-provider";
import { fmtInt } from "@/lib/format";

export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="8" fill="#E2B65B" />
      <rect x="7" y="18" width="4.5" height="7" rx="1.2" fill="#17120A" />
      <rect x="13.75" y="13" width="4.5" height="12" rx="1.2" fill="#17120A" />
      <rect x="20.5" y="8" width="4.5" height="17" rx="1.2" fill="#17120A" />
    </svg>
  );
}

export function SiteHeader() {
  const { state } = useLiveState();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold tracking-tight"
          aria-label="Mythic Bid home"
        >
          <BrandMark />
          <span className="text-[15px]">
            Mythic<span className="text-gold">Bid</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden items-center gap-3 md:flex">
            <span className="pill num" title="People on the site right now">
              <span className="live-dot" aria-hidden="true" />
              {state ? fmtInt(state.stats.online) : "—"} online
            </span>
            <span className="pill num" title="Unique visitors since launch">
              <Eye size={13} className="text-dim" aria-hidden="true" />
              {state ? fmtInt(state.stats.visitors) : "—"}
            </span>
          </div>

          <nav className="flex items-center gap-1 text-sm" aria-label="Main">
            <Link href="/rules" className="link-quiet rounded-lg px-3 py-1.5">
              Rules
            </Link>
            <Link href="/about" className="link-quiet rounded-lg px-3 py-1.5">
              About
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
