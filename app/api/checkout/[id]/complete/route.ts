import { getClientIp, jsonErr, jsonOk, readJsonBody } from "@/lib/api-utils";
import { getPayment, isExpired } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";
import { SettleError, applyProviderEvent } from "@/lib/settlement";

export const dynamic = "force-dynamic";

interface CompleteBody {
  /** Demo-mode card metadata — never raw PANs; validation is client-side. */
  last4?: unknown;
  brand?: unknown;
  /** Optional receipt email, linked to payments.users. */
  email?: unknown;
}

/**
 * Demo payment processor. It plays the role the provider plays in production:
 * simulate the charge, then emit a SIGNED-STYLE provider event through
 * applyProviderEvent() — the exact function /api/webhooks/[provider] uses for
 * live providers. The browser response is cosmetic; the ledger is the law.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = rateLimit(`complete:${getClientIp(req)}`, 10, 60_000);
  if (!gate.ok) return jsonErr("Too many attempts. Try again shortly.", 429);

  const payment = await getPayment(id);
  if (!payment) return jsonErr("Checkout not found.", 404);
  if (payment.status !== "pending") {
    // Idempotent UX: replaying a completed checkout shows its outcome without
    // writing another audit event.
    const result = await applyProviderEvent(
      {
        id: `evt_replay_${id}`,
        type: "payment.succeeded",
        data: { paymentId: id },
      },
      { recordEvent: false }
    );
    return jsonOk({
      rank: result.rank,
      listingId: result.listingId,
      name: result.name,
      kind: result.kind,
      amountCents: result.amountCents,
      alreadyProcessed: result.alreadyProcessed,
    });
  }
  if (isExpired(payment)) {
    return jsonErr("This checkout expired. Start a new claim.", 410);
  }

  const body = (await readJsonBody<CompleteBody>(req)) ?? {};
  const email = typeof body.email === "string" ? body.email : undefined;

  // Decline simulation (mirrors Stripe's test-card convention).
  if (typeof body.last4 === "string" && typeof body.brand === "string" && body.last4 === "0002") {
    await applyProviderEvent({
      id: `evt_fail_${crypto.randomUUID()}`,
      type: "payment.failed",
      data: { paymentId: id },
      payload: { reason: "card_declined", brand: body.brand },
    }).catch(() => undefined);
    return jsonErr("Your card was declined. Try a different card.", 402);
  }

  try {
    // Simulated processor latency for an honest interaction rhythm happens on
    // the client; settlement itself stays instant and atomic.
    const result = await applyProviderEvent({
      id: `evt_demo_${crypto.randomUUID()}`,
      type: "payment.succeeded",
      data: {
        paymentId: id,
        providerPaymentId: `demo_pi_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
        email,
      },
      payload: { mode: "demo", last4: typeof body.last4 === "string" ? body.last4 : null },
    });

    return jsonOk({
      rank: result.rank,
      listingId: result.listingId,
      name: result.name,
      kind: result.kind,
      amountCents: result.amountCents,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (err) {
    if (err instanceof SettleError) return jsonErr(err.message, err.status);
    return jsonErr("Payment could not be completed.", 500);
  }
}

export async function GET() {
  return jsonErr("Use POST.", 405);
}
