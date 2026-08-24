import { getClientIp, jsonErr, jsonOk, readJsonBody } from "@/lib/api-utils";
import { evaluateClaim } from "@/lib/claims";
import { createPendingPayment } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface ClaimBody {
  target?: unknown;
  amount?: unknown;
  category?: unknown;
  takeover?: unknown;
}

/**
 * Creates a pending payment for a validated claim and returns the checkout URL.
 * The rank is NOT claimed here — only a completed payment claims the rank.
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

  const existingId =
    evaluation.listingId ??
    (claim.kind === "new" ? null : (evaluation.listingId ?? null));

  let checkoutUrl: string;
  try {
    const payment = createPendingPayment({
      kind: claim.kind,
      amountCents: evaluation.diffCents ?? claim.amountCents,
      targetType: claim.parsed.type,
      targetInput:
        claim.parsed.type === "url"
          ? claim.parsed.url
          : claim.parsed.handle,
      displayKey: claim.parsed.displayKey,
      existingListingId: claim.kind === "new" ? null : existingId,
      resolvedName: claim.resolvedName || null,
      resolvedUrl: claim.resolvedUrl || null,
      categorySlug: claim.categorySlug,
    });
    checkoutUrl = `/checkout/${payment.id}`;
  } catch (err) {
    return jsonErr(err instanceof Error ? err.message : "Payment setup failed.", 500);
  }

  return jsonOk({
    checkoutUrl,
    mode: evaluation.mode,
    estimatedRank: evaluation.estimatedRank,
    amountCents: evaluation.diffCents ?? claim.amountCents,
  });
}
