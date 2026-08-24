import { getClientIp, jsonErr, jsonOk, readJsonBody } from "@/lib/api-utils";
import { getPayment, isExpired } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";
import { SettleError, completePayment } from "@/lib/settlement";
import { sqlite } from "@/lib/db";

export const dynamic = "force-dynamic";

interface CompleteBody {
  /** Demo-mode card metadata (never raw PANs — validation happens client-side). */
  last4?: unknown;
  brand?: unknown;
}

/**
 * Demo payment completion. In a live deployment this endpoint would be
 * replaced by the provider's webhook / confirmation flow; the settlement call
 * below stays identical either way.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = rateLimit(`complete:${getClientIp(req)}`, 10, 60_000);
  if (!gate.ok) return jsonErr("Too many attempts. Try again shortly.", 429);

  const payment = getPayment(id);
  if (!payment) return jsonErr("Checkout not found.", 404);

  if (isExpired(payment)) {
    sqlite
      .prepare("UPDATE payments SET status='expired' WHERE id=? AND status='pending'")
      .run(id);
    return jsonErr("This checkout expired. Start a new claim.", 410);
  }

  const body = (await readJsonBody<CompleteBody>(req)) ?? {};

  // Demo decline simulation so failure UX is exercised honestly:
  // any card ending in 0002 declines, mirroring Stripe's test convention.
  if (
    typeof body.last4 === "string" &&
    body.last4 === "0002" &&
    typeof body.brand === "string"
  ) {
    sqlite.prepare("UPDATE payments SET status='failed' WHERE id=? AND status='pending'").run(id);
    return jsonErr("Your card was declined. Try a different card.", 402);
  }

  try {
    const result = completePayment(id);
    return jsonOk({
      rank: result.rank,
      listingId: result.listingId,
      name: result.name,
      kind: result.kind,
      amountCents: result.amountCents,
    });
  } catch (err) {
    if (err instanceof SettleError) {
      return jsonErr(err.message, err.status);
    }
    return jsonErr("Payment could not be completed.", 500);
  }
}

export async function GET() {
  return jsonErr("Use POST.", 405);
}
