import { getClientIp, jsonErr, jsonOk, readJsonBody } from "@/lib/api-utils";
import { evaluateClaim } from "@/lib/claims";
import { createPendingPayment, pruneAbandonedListings } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface ClaimBody {
  target?: unknown;
  amount?: unknown;
  category?: unknown;
  takeover?: unknown;
}

/**
 * Validates a claim and opens a checkout: the listing placeholder is created
 * (or reused) and a PENDING payment row is written. Nothing here touches the
 * public ranking — that happens exclusively when a verified provider event
 * settles through applyProviderEvent().
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const gate = rateLimit(`claim:${ip}`, 8, 60_000);
  if (!gate.ok) {
    return jsonErr("Too many claims from this network. Try again in a minute.", 429);
  }

  const body = await readJsonBody<ClaimBody>(req);
  if (!body) return jsonErr("Malformed request.", 400);

  const evaluation = await evaluateClaim(
    {
      target: body.target,
      amount: body.amount,
      category: body.category,
      takeover: body.takeover,
    },
    { resolveTitles: true }
  );

  if (!evaluation.ok || !evaluation.claim) {
    return jsonErr(evaluation.error ?? "That claim could not be validated.", 400, {
      preview: evaluation,
    });
  }

  const claim = evaluation.claim;

  try {
    // Opportunistic GC of abandoned checkouts — cheap, indexed, no locks.
    await pruneAbandonedListings();

    const { payment, checkoutUrl } = await createPendingPayment({
      kind: claim.kind,
      amountCents: claim.chargeCents,
      targetType: claim.targetType,
      normalizedUrl: claim.normalizedUrl,
      displayName: claim.resolvedName || "Untitled spot",
      categorySlug: claim.categorySlug,
    });

    return jsonOk({
      checkoutUrl,
      mode: evaluation.mode,
      estimatedRank: evaluation.estimatedRank,
      amountCents: claim.chargeCents,
      provider: payment.provider,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Checkout could not be created.";
    return jsonErr(msg, 500);
  }
}
