import { notFound } from "next/navigation";
import { CheckoutClient } from "@/components/checkout-client";
import { getPayment, isExpired } from "@/lib/payments";
import { getListingById, getRankOfListing } from "@/lib/ranking";

export const dynamic = "force-dynamic";

export const metadata = { title: "Checkout" };

interface CheckoutPageProps {
  params: Promise<{ id: string }>;
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { id } = await params;
  const payment = getPayment(id);
  if (!payment) notFound();

  const targetLabel =
    payment.target_type === "handle"
      ? payment.target_input.startsWith("@")
        ? payment.target_input
        : `@${payment.target_input}`
      : payment.target_input.replace(/^https?:\/\//, "");

  /* Already paid → show the settled outcome. */
  if (payment.status === "completed" && payment.listing_id) {
    return (
      <CheckoutClient
        mode="done"
        amountCents={payment.amount_cents}
        kind={payment.kind}
        targetLabel={targetLabel}
        result={{ rank: getRankOfListing(payment.listing_id) }}
      />
    );
  }

  /* Expired / failed pendings are dead ends with a way back. */
  if (payment.status !== "pending" || isExpired(payment)) {
    return (
      <CheckoutClient
        mode="dead"
        amountCents={payment.amount_cents}
        kind={payment.kind}
        targetLabel={targetLabel}
      />
    );
  }

  return (
    <CheckoutClient
      mode="pay"
      paymentId={payment.id}
      amountCents={payment.amount_cents}
      kind={payment.kind}
      targetLabel={targetLabel}
      existingName={
        payment.kind !== "new"
          ? (getListingById(payment.existing_listing_id ?? "")?.name ?? undefined)
          : undefined
      }
    />
  );
}
