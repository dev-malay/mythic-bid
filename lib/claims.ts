/**
 * Claim engine — shared by /api/claim/preview and /api/claim so the price a
 * user is shown is ALWAYS the price they will be charged.
 *
 * Money model: listings.current_total is the materialized sum of succeeded
 * payments. A "raise" charges (new level − current_total); the payment ledger
 * records exactly what was charged.
 */

import {
  MAX_BID_USD,
  MIN_BID_USD,
  RAISE_STEP_USD,
  TAKEOVER_MULTIPLE,
  TOP_STEP_USD,
  autoDetectCategory,
  dollarsToCents,
  isValidCategory,
} from "./config";
import {
  estimateRank,
  getListingByNormalizedUrl,
  getTopListing,
} from "./ranking";
import { parseTarget, resolveListingName } from "./target";
import type { PreviewMode, PreviewResult } from "./types";

export interface EvaluatedClaim {
  normalizedUrl: string;
  targetType: "url" | "handle";
  amountCents: number;
  /** Cents actually charged for this checkout (full amount, or raise diff). */
  chargeCents: number;
  kind: "initial" | "raise" | "takeover";
  resolvedName: string;
  categorySlug: string;
}

export interface ClaimEvaluation extends PreviewResult {
  claim?: EvaluatedClaim;
}

function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}

function asInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return null;
}

export async function evaluateClaim(
  input: {
    target: unknown;
    amount: unknown;
    category?: unknown;
    takeover?: unknown;
  },
  options: { resolveTitles: boolean }
): Promise<ClaimEvaluation> {
  const targetRaw = typeof input.target === "string" ? input.target : "";
  const amountUsd = asInt(input.amount);
  const wantsTakeover = input.takeover === true;

  if (!targetRaw.trim()) {
    return { ok: false, error: "Enter your website URL or X @handle." };
  }

  const parsedTarget = parseTarget(targetRaw);
  if (!parsedTarget.ok) {
    return { ok: false, error: parsedTarget.error };
  }
  // Handles normalize to their profile URL so one column identifies targets.
  const normalizedUrl = parsedTarget.url;

  const existing = await getListingByNormalizedUrl(normalizedUrl);
  const mode: PreviewMode =
    existing && Number(existing.current_total) > 0 ? "raise" : "new";

  const top = await getTopListing();
  const minForTopCents = top
    ? Number(top.current_total) + dollarsToCents(TOP_STEP_USD)
    : dollarsToCents(MIN_BID_USD);
  const takeoverPriceCents = top
    ? Number(top.current_total) * TAKEOVER_MULTIPLE
    : dollarsToCents(MIN_BID_USD) * TAKEOVER_MULTIPLE;

  const base: PreviewResult = {
    ok: true,
    mode,
    listingId: existing?.id,
    listingName: existing?.display_name,
    currentBidCents: existing ? Number(existing.current_total) : undefined,
    minForTopCents,
    takeoverPriceCents,
  };

  if (amountUsd === null) {
    return { ...base, ok: false, error: "Enter a whole-dollar amount." };
  }
  if (amountUsd < MIN_BID_USD) {
    return {
      ...base,
      ok: false,
      error: `Bids start at $${MIN_BID_USD} — whole dollars only.`,
    };
  }
  if (amountUsd > MAX_BID_USD) {
    return {
      ...base,
      ok: false,
      error: `The board caps out at $${MAX_BID_USD.toLocaleString()}.`,
    };
  }
  const amountCents = dollarsToCents(amountUsd);

  let estimatedRank: number;
  let kind: "initial" | "raise" | "takeover";
  let chargeCents: number;

  if (wantsTakeover) {
    kind = "takeover";
    if (!existing || Number(existing.current_total) <= 0) {
      return {
        ...base,
        ok: false,
        error:
          "Takeovers are for listings already on the board — claim your spot first.",
      };
    }
    if (amountCents !== takeoverPriceCents) {
      return {
        ...base,
        ok: false,
        error: `A front-page takeover costs exactly ${usd(takeoverPriceCents)} right now (5× the top total).`,
      };
    }
    estimatedRank = 1;
    chargeCents = amountCents;
  } else if (mode === "new") {
    kind = "initial";
    estimatedRank = await estimateRank(amountCents);
    chargeCents = amountCents;
  } else {
    kind = "raise";
    const currentTotal = Number(existing!.current_total);
    if (amountCents < currentTotal + dollarsToCents(RAISE_STEP_USD)) {
      return {
        ...base,
        ok: false,
        error: `${existing!.display_name} sits at ${usd(currentTotal)}. Raise it to at least ${usd(currentTotal + dollarsToCents(RAISE_STEP_USD))}.`,
      };
    }
    estimatedRank = await estimateRank(amountCents, existing!.id);
    chargeCents = amountCents - currentTotal; // immutable event records the diff
  }

  // Category: explicit choice wins; otherwise suggest one from name/host.
  let categorySlug: string;
  let categorySuggestion: string | null;
  const explicit = typeof input.category === "string" ? input.category : undefined;
  if (isValidCategory(explicit) && explicit !== "other") {
    categorySlug = explicit!;
    categorySuggestion = explicit!;
  } else {
    const hostHint =
      parsedTarget.type === "url"
        ? parsedTarget.host
        : parsedTarget.handle.replace(/^@/, "");
    categorySuggestion = autoDetectCategory(existing?.display_name ?? "", hostHint);
    categorySlug = categorySuggestion;
  }

  // Resolve display name. New listings need one; raises refresh theirs.
  let resolvedName =
    existing?.display_name ??
    (parsedTarget.type === "handle" ? parsedTarget.handle : "");
  if (options.resolveTitles && parsedTarget.type === "url") {
    const fetched = await resolveListingName(parsedTarget);
    if (fetched) resolvedName = fetched;
  }
  if (!resolvedName) {
    resolvedName =
      parsedTarget.type === "url" ? parsedTarget.host : parsedTarget.handle;
  }

  return {
    ...base,
    diffCents: chargeCents,
    estimatedRank,
    categorySuggestion,
    claim: {
      normalizedUrl,
      targetType: parsedTarget.type,
      amountCents,
      chargeCents,
      kind,
      resolvedName: resolvedName.slice(0, 120),
      categorySlug,
    },
  };
}
