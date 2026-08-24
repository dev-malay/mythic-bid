"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Crown, Loader2, TrendingUp } from "lucide-react";
import { useLiveState } from "@/components/live-state-provider";
import { CATEGORIES, TAKEOVER_MULTIPLE } from "@/lib/config";
import { fmtUSD } from "@/lib/format";
import type { PreviewResult } from "@/lib/types";

interface Props {
  initialTopPriceCents: number;
  /** Server snapshot: does any listing currently hold #1? */
  initialHasTop: boolean;
}

/**
 * The claim form. Live-updating #1 price, debounced rank previews that share
 * validation logic with the server (same engine), raise detection for
 * existing listings, and the 5× front-page takeover.
 */
export function ClaimForm({ initialTopPriceCents, initialHasTop }: Props) {
  const router = useRouter();
  const { state } = useLiveState();

  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState("");
  const [takeover, setTakeover] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const topPriceCents = state?.topPriceCents ?? initialTopPriceCents;
  const hasTop = state ? Boolean(state.topListingId) : initialHasTop;
  const topBidCents = state?.board[0]?.bidCents ?? null;
  const takeoverPriceCents =
    topBidCents !== null ? topBidCents * TAKEOVER_MULTIPLE : null;

  const amountNum = useMemo(() => {
    const n = parseInt(amount.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [amount]);

  /* ------------------------- preview (debounced) ------------------------ */

  const seqRef = useRef(0);
  useEffect(() => {
    if (!target.trim() || amountNum === null) {
      setPreview(null);
      return;
    }
    const seq = ++seqRef.current;
    setPreviewing(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/claim/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target,
            amount: amountNum,
            category: category || undefined,
            takeover,
          }),
        });
        const data = (await res.json()) as PreviewResult;
        if (seq === seqRef.current) setPreview(data);
      } catch {
        if (seq === seqRef.current) setPreview(null);
      } finally {
        if (seq === seqRef.current) setPreviewing(false);
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [target, amountNum, category, takeover]);

  // Reset the takeover toggle when it becomes unavailable.
  useEffect(() => {
    if (takeover && !hasTop) setTakeover(false);
  }, [takeover, hasTop]);

  const applyTakeoverPrice = useCallback(() => {
    if (takeoverPriceCents) setAmount(String(Math.round(takeoverPriceCents / 100)));
  }, [takeoverPriceCents]);

  const onToggleTakeover = () => {
    const next = !takeover;
    setTakeover(next);
    if (next) applyTakeoverPrice();
  };

  /* ------------------------------ submit -------------------------------- */

  const canSubmit =
    !submitting &&
    target.trim().length > 0 &&
    amountNum !== null &&
    preview?.ok === true;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !preview) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          amount: amountNum,
          category: category || undefined,
          takeover,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        checkoutUrl?: string;
      };
      if (data.ok && data.checkoutUrl) {
        router.push(data.checkoutUrl);
        return;
      }
      setSubmitError(data.error ?? "Something went wrong. Try again.");
    } catch {
      setSubmitError("Network hiccup — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ------------------------------- render ------------------------------- */

  const heading = takeover
    ? takeoverPriceCents
      ? `Own the front page for ${fmtUSD(takeoverPriceCents)}`
      : "Own the front page"
    : hasTop
      ? `Claim #1 for ${fmtUSD(topPriceCents)}`
      : "Be first on the board";

  const ctaLabel = (() => {
    if (takeover) return "Buy the spotlight";
    if (!preview?.ok) return "Claim your spot";
    if (preview.mode === "raise" && preview.diffCents != null) {
      return `Raise to ${fmtUSD((preview.currentBidCents ?? 0) + preview.diffCents)} — pay ${fmtUSD(preview.diffCents)}`;
    }
    return `Claim spot for ${fmtUSD((amountNum ?? 0) * 100)}`;
  })();

  return (
    <section className="panel mx-auto w-full max-w-2xl p-6 sm:p-7" aria-labelledby="claim-heading">
      <h2
        id="claim-heading"
        className="text-center text-xl font-semibold tracking-tight sm:text-[22px]"
      >
        {heading}
      </h2>
      <p className="mt-1.5 text-center text-[13px] text-mute">
        New spots start at $5. Bid less than the top and you still take the
        highest rank your bid can reach.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-[1fr_170px]">
          <div>
            <label htmlFor="claim-target" className="label-xs">
              Website or X handle
            </label>
            <input
              id="claim-target"
              className="input"
              placeholder="yourproduct.com or @handle"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="claim-amount" className="label-xs">
              Amount (USD)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mute">
                $
              </span>
              <input
                id="claim-amount"
                className="input num pl-7"
                placeholder="500"
                inputMode="numeric"
                pattern="\d*"
                autoComplete="off"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 7))
                }
              />
            </div>
          </div>
        </div>

        {/* Quick amounts */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quick amounts">
          {[5, 100, 500].map((v) => (
            <button
              key={v}
              type="button"
              className="chip num"
              data-active={amountNum === v}
              onClick={() => setAmount(String(v))}
            >
              ${v}
            </button>
          ))}
          <button
            type="button"
            className="chip"
            data-active={amountNum !== null && amountNum * 100 >= topPriceCents}
            onClick={() => setAmount(String(Math.round(topPriceCents / 100)))}
          >
            <TrendingUp size={13} aria-hidden="true" />
            Beat top · {fmtUSD(topPriceCents)}
          </button>

          <div className="ml-auto">
            <label htmlFor="claim-category" className="sr-only">
              Category
            </label>
            <select
              id="claim-category"
              className="input cursor-pointer py-2 text-[13px]"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              title="Category — we'll guess if you're unsure"
            >
              <option value="">Category: auto</option>
              {CATEGORIES.filter((c) => c.slug !== "other").map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live preview line */}
        <div className="min-h-[22px]" aria-live="polite">
          {previewing && !preview ? (
            <p className="flex items-center gap-2 text-[13px] text-dim">
              <Loader2 size={13} className="spinner" /> Checking the board…
            </p>
          ) : preview && !preview.ok && preview.error ? (
            <p className="text-[13px] text-bad">{preview.error}</p>
          ) : preview?.ok && preview.mode === "raise" ? (
            <p className="text-[13px] text-mute">
              <span className="font-medium text-gold-strong">{preview.listingName}</span>{" "}
              is already listed at{" "}
              <span className="num">{fmtUSD(preview.currentBidCents ?? 0)}</span>.
              You&apos;d pay only the difference.
              {typeof preview.estimatedRank === "number" && (
                <>
                  {" "}
                  New rank ≈ <span className="num font-semibold text-ink">#{preview.estimatedRank}</span>.
                </>
              )}
            </p>
          ) : preview?.ok && typeof preview.estimatedRank === "number" ? (
            <p className="text-[13px] text-mute">
              That bid takes{" "}
              <span className="num font-semibold text-gold-strong">
                {preview.estimatedRank === 1 ? "#1 — the top spot." : `#${preview.estimatedRank}`}
              </span>
              {preview.estimatedRank > 1 && " on the board."}
            </p>
          ) : null}
        </div>

        {/* Takeover */}
        <label
          className={`flex items-start gap-3 rounded-[10px] border p-3 transition-colors ${
            takeover
              ? "border-gold/40 bg-gold/5"
              : "border-line bg-bg hover:border-line-strong"
          } ${hasTop ? "cursor-pointer" : "opacity-50"}`}
        >
          <input
            type="checkbox"
            className="peer sr-only"
            checked={takeover}
            onChange={onToggleTakeover}
            disabled={!hasTop}
          />
          <Crown size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
          <span className="text-[13px] leading-relaxed">
            <span className="font-semibold text-ink">Front-page takeover</span>
            <span className="text-mute">
              {" "}
              — lock a spotlight above the board for 3 hours. Costs exactly 5×
              the top bid{takeoverPriceCents ? ` (${fmtUSD(takeoverPriceCents)})` : ""}.
            </span>
          </span>
        </label>

        {submitError && (
          <p className="text-[13px] text-bad" role="alert">
            {submitError}
          </p>
        )}

        <button type="submit" className="btn btn-primary w-full text-[15px]" disabled={!canSubmit}>
          {submitting ? (
            <>
              <Loader2 size={15} className="spinner" aria-hidden="true" />
              Setting up checkout…
            </>
          ) : (
            <>
              {ctaLabel}
              <ArrowRight size={15} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-dim">
        Already on the list? Enter the same URL or @handle and pay only the
        difference to climb.
      </p>
    </section>
  );
}
