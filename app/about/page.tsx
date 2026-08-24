export const metadata = {
  title: "About",
  description:
    "Mythic Bid started as a simple experiment: no ads, no API keys, no revenue sharing. Just outbid your competitors to rank #1.",
};

import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <p className="eyebrow">The story</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        About Mythic Bid
      </h1>

      <div className="prose-tight mt-6 space-y-5 leading-relaxed">
        <p>
          Mythic Bid started as a simple side project: no ads, no API keys, no
          revenue sharing. Just outbid your competitors to rank #1 — that&apos;s
          it.
        </p>
        <p>
          Every discovery platform pretends its ranking measures something
          noble: relevance, quality, community love. Mythic Bid skips the
          pretense entirely. There is one board, one metric, and one rule —{" "}
          <strong>the highest bidder is number one</strong>. Your bid is public,
          your rank is public, and your click count is public. When someone pays
          more, they take your spot and everyone sees the price.
        </p>
        <p>
          That transparency turned out to be the product. Founders get a launch
          moment that can be defended with another payment. Spectators get a
          scoreboard where every position has a visible cost. Nobody wonders how
          the algorithm works, because there isn&apos;t one.
        </p>

        <h2>How it works</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Submit a product website or an X @handle.</li>
          <li>Bid in whole US dollars — spots start at $5.</li>
          <li>You land at the highest rank that amount can reach.</li>
          <li>
            Already listed? Enter the same target and pay only the difference to
            climb.
          </li>
          <li>
            Want the whole front page? Buy a takeover at 5× the top bid and lock
            a spotlight for three hours.
          </li>
        </ol>

        <h2>Questions people actually ask</h2>
        <dl className="space-y-4">
          <div>
            <dt className="font-semibold not-prose text-ink">Is this an ad network?</dt>
            <dd>
              No. There are no campaigns, no targeting, no impressions sold by
              anyone. One board, one auction, running in public forever.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Can I lose my spot?</dt>
            <dd>
              Yes, at any moment. Someone only needs to outbid you by a dollar.
              Your listing stays on the board; only its rank moves.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Do bids stack?</dt>
            <dd>
              Your all-time total does — it&apos;s the sum of everything you
              spent. But your rank comes from your last claimed level, so the
              way back up is paying the difference.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Are payments real?</dt>
            <dd>
              This build ships with a demo checkout so the full loop works
              end-to-end without live keys — no real cards are charged. The
              settlement engine behind it is production-shaped: transactional,
              race-safe, and idempotent.
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-12 border-t border-line pt-6 flex items-center gap-3">
        <Link href="/" className="btn btn-secondary">
          Back to the board
        </Link>
        <Link href="/rules" className="btn btn-secondary">
          Read the rules
        </Link>
      </div>
    </div>
  );
}
