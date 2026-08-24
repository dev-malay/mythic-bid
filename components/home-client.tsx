"use client";

/**
 * Client shell for the homepage. Receives the server-built snapshot for
 * instant first paint (client components are still SSR'd) and then follows
 * the shared polling context for everything live.
 */

import { ClaimForm } from "@/components/claim-form";
import { BoardSection } from "@/components/board-section";
import { ActivityFeed, HowItWorks } from "@/components/activity-feed";
import { TakeoverSpotlight } from "@/components/takeover-spotlight";
import { useLiveState } from "@/components/live-state-provider";
import { fmtInt, fmtUSD } from "@/lib/format";
import type { StatePayload } from "@/lib/types";

export function HomeClient({ initial }: { initial: StatePayload }) {
  const { state } = useLiveState();
  const s = state ?? initial;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      {/* ------------------------------ Hero ------------------------------ */}
      <section className="pb-10 pt-14 text-center sm:pt-20">
        <p className="eyebrow">The paid leaderboard</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-[52px] sm:leading-[1.08]">
          Rank is the bid.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-[15px] leading-relaxed text-mute">
          No ads. No algorithms. No mercy. Pay more than everyone else to stand
          above them — get outranked, pay the difference, climb again.
        </p>

        <div
          className="num mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[13px] text-dim"
          aria-label="Live board stats"
        >
          <span>
            <span className="font-semibold text-mute">{fmtUSD(s.topPriceCents)}</span>{" "}
            to take #1
          </span>
          <span aria-hidden="true" className="text-line-strong">·</span>
          <span>
            <span className="font-semibold text-mute">{fmtInt(s.stats.listings)}</span>{" "}
            spots taken
          </span>
          <span aria-hidden="true" className="text-line-strong">·</span>
          <span>
            <span className="font-semibold text-mute">
              {fmtUSD(s.stats.revenueCents)}
            </span>{" "}
            paid in
          </span>
        </div>
      </section>

      <ClaimForm
        initialTopPriceCents={initial.topPriceCents}
        initialHasTop={Boolean(initial.topListingId)}
      />

      {/* --------------------------- Takeover ----------------------------- */}
      {s.takeover && (
        <div className="mt-12">
          <TakeoverSpotlight takeover={s.takeover} />
        </div>
      )}

      {/* ------------------------- Board + rail --------------------------- */}
      <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <BoardSection
          initialBoard={initial.board}
          initialTodayBoard={initial.todayBoard}
          initialNow={initial.now}
        />
        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <HowItWorks />
          <ActivityFeed items={s.activity} now={s.now} />
        </aside>
      </div>
    </div>
  );
}
