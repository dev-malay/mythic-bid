import { notFound } from "next/navigation";
import { CheckoutClient } from "@/components/checkout-client";
import { getPayment, isExpired } from "@/lib/payments";
import { getListingById, getRankOfListing } from "@/lib/ranking";

export const dynamic = "force-dynamic";

export const metadata = { title: "Checkout" };

interface CheckoutPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; canceled?: string }>;
}

export default async function CheckoutPage({
  params,
  searchParams,
}: CheckoutPageProps) {
  const { id } = await params;
  const { paid } = await searchParams;
  const payment = await getPayment(id);
  if (!payment) notFound();

  /* Target label comes from the listing row (single source of truth). */
  const listing = await getListingById(payment.listing_id);
  const targetLabel = listing
    ? listing.target_type === "handle"
      ? listing.normalized_url.replace(/^https:\/\/x\.com\//i, "@")
      : listing.normalized_url.replace(/^https?:\/\//, "")
    : "your spot";

  /* Already settled → show the recorded outcome. */
  if (payment.status === "succeeded") {
    return (
      <CheckoutClient
        mode="done"
        amountCents={Number(payment.amount)}
        kind={payment.kind}
        targetLabel={targetLabel}
        result={{ rank: await getRankOfListing(payment.listing_id) }}
      />
    );
  }

  /* Returned from the hosted provider page, webhook not yet applied. */
  if (
    payment.status === "pending" &&
    payment.provider !== "demo" &&
    (paid === "1" || paid === "true")
  ) {
    return (
      <CheckoutClient
        mode="waiting"
        paymentId={payment.id}
        amountCents={Number(payment.amount)}
        kind={payment.kind}
        targetLabel={targetLabel}
      />
    );
  }

  /* Expired / failed pendings are dead ends with a way back. */
  if (payment.status !== "pending" || isExpired(payment)) {
    return (
      <CheckoutClient
        mode="dead"
        amountCents={Number(payment.amount)}
        kind={payment.kind}
        targetLabel={targetLabel}
      />
    );
  }

  return (
    <CheckoutClient
      mode="pay"
      paymentId={payment.id}
      amountCents={Number(payment.amount)}
      kind={payment.kind}
      targetLabel={targetLabel}
      existingName={
        payment.kind !== "initial"
          ? (listing?.display_name ?? undefined)
          : undefined
      }
    />
  );
}
