"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Clock3, MousePointerClick } from "lucide-react";
import { useLiveState } from "@/components/live-state-provider";
import { fmtInt, fmtUSD, relTime } from "@/lib/format";
import type { BoardEntry, TodayBoardEntry } from "@/lib/ranking";

type BoardTab = "all" | "today";

interface Props {
  initialBoard: BoardEntry[];
  initialTodayBoard: TodayBoardEntry[];
  initialNow: number;
}

const PAGE_SIZE = 50;

/**
 * The leaderboard. Server-rendered first paint, then kept alive by the shared
 * polling context. Rank changes flash green (up) / red (down) per row.
 */
export function BoardSection({ initialBoard, initialTodayBoard, initialNow }: Props) {
  const { state } = useLiveState();
  const [tab, setTab] = useState<BoardTab>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const board = state?.board ?? initialBoard;
  const todayBoard = state?.todayBoard ?? initialTodayBoard;
  const now = state?.now ?? initialNow;

  useEffect(() => setVisible(PAGE_SIZE), [tab, category]);

  const source: Array<BoardEntry | TodayBoardEntry> = tab === "all" ? board : todayBoard;
  const filtered = useMemo(
    () =>
      category
        ? source.filter((entry) => entry.category === category)
        : source,
    [source, category]
  );
  const shown = filtered.slice(0, visible);

  return (
    <section aria-labelledby="board-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="board-heading" className="text-lg font-semibold tracking-tight">
          The Board
          <span className="num ml-2 text-sm font-normal text-dim">
            {fmtInt(filtered.length)}
          </span>
        </h2>

        <div
          className="flex rounded-[10px] border border-line p-0.5"
          role="tablist"
          aria-label="Board period"
        >
          {(
            [
              ["all", "All-time"],
              ["today", "Last 24 hours"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                tab === key
                  ? "bg-panel-2 text-ink"
                  : "text-mute hover:text-ink"
              }`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Category chips */}
      <div className="scrollbar-none -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button className="chip" data-active={category === null} onClick={() => setCategory(null)}>
          All
        </button>
        {(state?.categories ?? [])
          .filter((c) => c.count > 0)
          .map((c) => (
            <button
              key={c.slug}
              className="chip num"
              data-active={category === c.slug}
              onClick={() => setCategory(category === c.slug ? null : c.slug)}
            >
              {c.label}
              <span className="text-[11px] text-dim">{c.count}</span>
            </button>
          ))}
      </div>

      <ol className="panel divide-y divide-line overflow-hidden">
        {shown.map((entry) => (
          <BoardRow
            key={`${tab}-${category ?? "all"}-${entry.id}`}
            entry={entry}
            now={now}
            isToday={tab === "today"}
          />
        ))}

        {shown.length === 0 && (
          <li className="px-5 py-14 text-center text-sm text-dim">
            {tab === "today"
              ? "Nothing on the board in the last 24 hours. Be the first."
              : "This category is still empty. Claim it."}
          </li>
        )}
      </ol>

      {visible < filtered.length && (
        <div className="mt-4 text-center">
          <button
            className="btn btn-secondary"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
          >
            Show more ({fmtInt(filtered.length - visible)})
          </button>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

const RANK_TONE = [
  "text-gold-strong",
  "text-gold/80",
  "text-gold-deep",
] as const;

function BoardRow({
  entry,
  now,
  isToday,
}: {
  entry: BoardEntry | TodayBoardEntry;
  now: number;
  isToday: boolean;
}) {
  const prevRankRef = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const prev = prevRankRef.current;
    if (prev !== null && prev !== entry.rank) {
      setFlash(entry.rank < prev ? "up" : "down");
      const timer = setTimeout(() => setFlash(null), 1400);
      prevRankRef.current = entry.rank;
      return () => clearTimeout(timer);
    }
    prevRankRef.current = entry.rank;
  }, [entry.rank]);

  const href = `/go/${entry.id}`;
  const displayTarget =
    entry.targetType === "handle" ? entry.handle : entry.host;

  return (
    <li
      className={`transition-colors ${flash === "up" ? "flash-up" : ""} ${
        flash === "down" ? "flash-down" : ""
      }`}
    >
      <a
        href={href}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        className="group flex items-center gap-3 px-4 py-3 hover:bg-panel-2 sm:px-5"
        title={`Visit ${entry.name}`}
      >
        {/* Rank */}
        <span
          className={`num w-9 shrink-0 text-right text-[15px] font-semibold tabular-nums ${
            entry.rank <= 3 ? RANK_TONE[entry.rank - 1] : "text-dim"
          }`}
          aria-label={`Rank ${entry.rank}`}
        >
          {entry.rank}
        </span>

        <FaviconTile name={entry.name} host={entry.targetType === "url" ? (entry.host ?? "") : "x.com"} />

        {/* Name + target */}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium leading-snug text-ink">
            {entry.name}
          </span>
          <span className="block truncate text-xs leading-snug text-dim">
            {displayTarget}
          </span>
        </span>

        {/* Metrics */}
        <span className="hidden shrink-0 items-center gap-2 text-xs text-dim md:flex">
          <MousePointerClick size={13} aria-hidden="true" />
          <span className="num">{fmtInt(entry.clicks)}</span>
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 text-xs text-dim lg:flex">
          <Clock3 size={13} aria-hidden="true" />
          <span className="num">{relTime(entry.lastClaimedAt, now)}</span>
        </span>

        <span className="w-[86px] shrink-0 text-right">
          {isToday && "todaySpendCents" in entry ? (
            <>
              <span className="num block text-[14px] font-semibold text-good">
                {fmtUSD(entry.todaySpendCents)}
              </span>
              <span className="num block text-[11px] text-dim">
                of {fmtUSD(entry.bidCents)} all-time
              </span>
            </>
          ) : (
            <span className="num block text-[14px] font-semibold text-gold-strong">
              {fmtUSD(entry.bidCents)}
            </span>
          )}
        </span>

        <ArrowUpRight
          size={15}
          className="shrink-0 text-dim opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </a>
    </li>
  );
}

export function FaviconTile({
  name,
  host,
  size = 34,
}: {
  name: string;
  host: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const letter = (name || "?").replace(/^@/, "").charAt(0).toUpperCase();

  if (failed) {
    return (
      <span
        className="flex shrink-0 select-none items-center justify-center rounded-md border border-line bg-panel-2 text-[13px] font-semibold text-mute"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {letter}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-md border border-line bg-panel-2 object-contain p-0.5"
      style={{ width: size, height: size }}
    />
  );
}
