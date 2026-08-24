export const metadata = {
  title: "Rules",
  description:
    "Mythic Bid is a public leaderboard. There are no ads, no API keys, and no revenue share. You pay to stand above everyone else — rank is the bid, nothing else.",
};

import Link from "next/link";
import { MIN_BID_USD, MAX_BID_USD, RAISE_STEP_USD, TAKEOVER_HOURS, TAKEOVER_MULTIPLE, TOP_STEP_USD } from "@/lib/config";

function usd(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <p className="eyebrow">The rulebook</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Rules</h1>
      <p className="prose-tight mt-5 leading-relaxed">
        Mythic Bid is a public leaderboard. There are no ads, no API keys, and
        no revenue share. You pay to stand above everyone else.{" "}
        <strong>Rank is the bid</strong> — nothing else.
      </p>

      <div className="prose-tight mt-4">
        <h2>The board</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            New listings are whole US dollars: {usd(MIN_BID_USD)} minimum,{" "}
            {usd(MAX_BID_USD)} maximum. Bids already on the board keep their
            amount until they raise or get outranked.
          </li>
          <li>
            Taking #1 costs at least {usd(TOP_STEP_USD)} more than the current
            top bid. Paying less still puts you on the board at whatever rank
            that bid can reach.
          </li>
          <li>
            Equal bids stay in the order they were placed —{" "}
            <strong>the older bid keeps the higher rank</strong>.
          </li>
        </ul>

        <h2>Today&apos;s board</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Today&apos;s board ranks what you spent in the last 24 hours. Each
            payment counts for a day from when you paid, then drops off.
          </li>
          <li>
            The same payment also adds to your all-time bid. Taking today&apos;s
            #1 costs at least {usd(TOP_STEP_USD)} more than the most anyone else
            spent in that window.
          </li>
        </ul>

        <h2>Raising your bid</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Enter the same website or @handle again to raise that listing to any
            rank. The new level must be at least {usd(RAISE_STEP_USD)} above
            your current one; <strong>you only pay the difference</strong>.
          </li>
          <li>
            A completed payment is what claims the rank. Setting up checkout
            reserves nothing.
          </li>
        </ul>

        <h2>Front-page takeover</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Listings already on the board can buy a takeover for exactly{" "}
            {TAKEOVER_MULTIPLE}× the current top bid. The spotlight sits above
            the board for {TAKEOVER_HOURS} consecutive hours.
          </li>
          <li>
            The money you spend on a takeover also raises your all-time and
            24-hour totals, like any other payment.
          </li>
        </ul>

        <h2>What you can list</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>A product website, or an X @handle.</li>
          <li>
            Chat and invite links are not allowed — Telegram, WhatsApp,
            Discord, Messenger, Signal, and similar. The board is for products
            and profiles, not group chats.
          </li>
          <li>
            Links to sexual content are not allowed. If it is porn, NSFW, or an
            adult platform, it does not belong on the board.
          </li>
          <li>
            Query parameters are stripped from listing links. Affiliate,
            referral, and tracking URLs will not work.
          </li>
          <li>
            Link shortener URLs are not allowed. Submit the destination, not
            the redirect.
          </li>
        </ul>

        <h2>Everything else</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Categories are suggested automatically when you claim. You can pick
            your own before paying.
          </li>
          <li>Your listing is public. Clicks go to the URL or profile you submitted, without query parameters.</li>
          <li>Rank changes are live. Refreshing is part of the sport.</li>
        </ul>
      </div>

      <div className="mt-12 border-t border-line pt-6">
        <Link href="/" className="btn btn-secondary">
          Back to the board
        </Link>
      </div>
    </div>
  );
}
