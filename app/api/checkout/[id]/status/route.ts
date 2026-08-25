import { jsonOk } from "@/lib/api-utils";
import { getPayment } from "@/lib/payments";
import { getRankOfListing } from "@/lib/ranking";

export const dynamic = "force-dynamic";

/**
 * Lightweight payment status for hosted-checkout returns. After paying on a
 * provider page (e.g., Dodo), the bidder lands back on /checkout/[id]?paid=1
 * and this endpoint is polled until the signed webhook flips status to
 * succeeded — then the client reloads into the settled view.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payment = await getPayment(id);
  if (!payment) return jsonOk({ status: "unknown" });

  const rank =
    payment.status === "succeeded"
      ? await getRankOfListing(payment.listing_id)
      : null;

  return jsonOk({
    status: payment.status,
    rank,
    kind: payment.kind,
    amountCents: Number(payment.amount),
  });
}
