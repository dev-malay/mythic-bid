"use client";

import { Megaphone } from "lucide-react";
import { fmtUSD, relTime } from "@/lib/format";
import type { ActivityItem } from "@/lib/types";

const VERBS: Record<ActivityItem["kind"], string> = {
  new: "took",
  raise: "raised to",
  takeover: "bought the spotlight for",
};

const KIND_TONE: Record<ActivityItem["kind"], string> = {
  new: "bg-gold",
  raise: "bg-good",
  takeover: "bg-gold-strong",
};

export function ActivityFeed({ items, now }: { items: ActivityItem[]; now: number }) {
  return (
    <section aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="mb-3 text-[15px] font-semibold tracking-tight">
        Latest activity
      </h2>

      {items.length === 0 ? (
        <div className="panel px-4 py-8 text-center text-sm text-dim">
          No moves yet. The first claim writes history.
        </div>
      ) : (
        <ol className="panel divide-y divide-line overflow-hidden">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5 px-4 py-2.5">
              <span
                className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${KIND_TONE[item.kind]}`}
                aria-hidden="true"
              />
              <p className="min-w-0 flex-1 truncate text-[13px] leading-relaxed text-mute">
                <span className="font-medium text-ink">{item.name}</span>{" "}
                {VERBS[item.kind]}{" "}
                <span className="num text-gold-strong">#{item.rank}</span>
                {" · "}
                <span className="num">{fmtUSD(item.amountCents)}</span>
              </p>
              <time
                className="num shrink-0 text-[11px] text-dim"
                dateTime={new Date(item.createdAt).toISOString()}
                title={new Date(item.createdAt).toLocaleString()}
              >
                {relTime(item.createdAt, now)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Compact "how it works" card for the right rail. */
export function HowItWorks() {
  const steps = [
    ["Bid", "Whole dollars, $5 minimum. Your amount is your rank."],
    ["Get outranked", "Anyone can pay $1 more than you and take your spot."],
    ["Climb again", "Enter the same URL or @handle — pay only the difference."],
  ] as const;

  return (
    <section className="panel p-5" aria-labelledby="hiw-heading">
      <h2 id="hiw-heading" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
        <Megaphone size={15} className="text-gold" aria-hidden="true" />
        How it works
      </h2>
      <ol className="mt-3 space-y-3">
        {steps.map(([title, body], i) => (
          <li key={title} className="flex gap-3">
            <span className="num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line text-[11px] font-semibold text-mute">
              {i + 1}
            </span>
            <p className="text-[13px] leading-relaxed text-mute">
              <span className="font-semibold text-ink">{title}.</span> {body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
