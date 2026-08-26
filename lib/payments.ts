/**
 * Checkout creation.
 *
 * A listing row ALWAYS exists before its payment does (payments.listing_id is
 * NOT NULL): brand-new targets are inserted immediately with current_total = 0
 * — invisible on the board until the first verified payment lands. The UNIQUE
 * constraint on normalized_url makes concurrent claims of the same target
 * resolve deterministically at the database level.
 *
 * Providers:
 *   demo — internal checkout page, settles through the same event pipeline.
 *   dodo — Dodo Payments (merchant of record) hosted checkout. Requires a
 *          one-time Pay-What-You-Want product in the dashboard; the exact bid
 *          amount is pinned per session via product_cart[].amount. Settlement
 *          happens exclusively through the signed webhook -> applyProviderEvent().
 */

import { CHECKOUT_TTL_MS } from "./config";
import { ensureSchema, sql, type PaymentRow } from "./db";

export type PaymentMode = "demo" | "dodo";

export function getPaymentMode(): PaymentMode {
  const mode = (process.env.PAYMENT_MODE ?? "demo").toLowerCase();
  return mode === "dodo" ? "dodo" : "demo";
}

export interface CreateCheckoutInput {
  /** 'initial' for a brand-new spot, 'raise' to climb, 'takeover' for spotlight. */
  kind: "initial" | "raise" | "takeover";
  /** Cents ACTUALLY CHARGED (the immutable financial event's amount). */
  amountCents: number;
  targetType: "url" | "handle";
  normalizedUrl: string;
  displayName: string;
  categorySlug: string;
}

export interface CreateCheckoutResult {
  payment: PaymentRow;
  /** Where to send the bidder: internal demo checkout or hosted provider page. */
  checkoutUrl: string;
}

export async function createPendingPayment(
  input: CreateCheckoutInput
): Promise<CreateCheckoutResult> {
  await ensureSchema();
  const mode = getPaymentMode();

  const checkoutId = `chk_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

  /* 1 — persist the pending payment (and the listing placeholder). */
  const payment = await sql.begin(async (tx) => {
    const inserted = await tx`
      insert into public.listings (normalized_url, target_type, display_name, category_slug)
      values (${input.normalizedUrl}, ${input.targetType}, ${input.displayName}, ${input.categorySlug})
      on conflict (normalized_url) do nothing
      returning id
    `;
    let listingId = inserted[0]?.id as string | undefined;
    if (!listingId) {
      const existing = await tx`
        select id from public.listings where normalized_url = ${input.normalizedUrl}
      `;
      listingId = existing[0]?.id as string;
    }

    const rows = await tx`
      insert into public.payments
        (listing_id, provider, provider_checkout_id, amount, currency, kind, status)
      values (${listingId}, ${mode === "demo" ? "demo" : "dodo"},
              ${mode === "demo" ? checkoutId : null},
              ${input.amountCents}, 'usd', ${input.kind}, 'pending')
      returning *
    `;
    return rows[0] as PaymentRow;
  });

  /* 2 — create the hosted checkout with the provider. */
  if (mode === "dodo") {
    const url = await createDodoCheckout(payment.id, input);
    return { payment, checkoutUrl: url };
  }

  return { payment, checkoutUrl: `/checkout/${payment.id}` };
}

/* ------------------------------------------------------------------ */
/* Dodo Payments                                                       */
/* ------------------------------------------------------------------ */

function dodoBaseUrl(): string {
  const explicit = process.env.DODO_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  // Test keys hit the sandbox; live keys hit production.
  return (process.env.DODO_SECRET_KEY ?? "").startsWith("sk_live_")
    ? "https://live.dodopayments.com"
    : "https://test.dodopayments.com";
}

async function createDodoCheckout(
  paymentId: string,
  input: CreateCheckoutInput
): Promise<string> {
  const key = process.env.DODO_SECRET_KEY;
  if (!key) {
    throw new Error(
      "PAYMENT_MODE=dodo requires DODO_SECRET_KEY (sk_test_… during development)."
    );
  }
  const productId = process.env.DODO_PRODUCT_ID;
  if (!productId) {
    throw new Error(
      "PAYMENT_MODE=dodo requires DODO_PRODUCT_ID — a one-time Pay-What-You-Want product created in the Dodo dashboard (minimum $5)."
    );
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const res = await fetch(`${dodoBaseUrl()}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_cart: [
        {
          product_id: productId,
          quantity: 1,
          amount: input.amountCents, // exact bid amount, minor units
        },
      ],
      billing_currency: "USD",
      metadata: { payment_id: paymentId },
      // Correlation fallback if metadata is ever missing from webhook payloads.
      custom_fields: [],
      return_url: `${site}/checkout/${paymentId}?paid=1`,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const json = (await res.json()) as {
    checkout_url?: string | null;
    session_id?: string;
    error?: { message?: string } | string;
  };
  if (!res.ok || !json.checkout_url) {
    const msg =
      typeof json.error === "string"
        ? json.error
        : json.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Dodo checkout failed: ${msg}`);
  }

  if (json.session_id) {
    await sql`
      update public.payments set provider_checkout_id = ${json.session_id}
      where id = ${paymentId}
    `;
  }
  return json.checkout_url;
}

export async function getPayment(id: string): Promise<PaymentRow | undefined> {
  await ensureSchema();
  const rows = await sql`select * from public.payments where id = ${id}`;
  return rows[0] as PaymentRow | undefined;
}

export function isExpired(payment: PaymentRow, nowMs = Date.now()): boolean {
  return (
    payment.status === "pending" &&
    nowMs - new Date(payment.created_at).getTime() > CHECKOUT_TTL_MS
  );
}

/**
 * Garbage-collects abandoned zero-total listings (checkouts nobody finished).
 * Listings with successful payment history are never touched — even if
 * refunds brought their total back to zero.
 */
export async function pruneAbandonedListings(): Promise<void> {
  await ensureSchema();
  await sql`
    delete from public.listings l
    where l.current_total = 0
      and l.created_at < now() - interval '24 hours'
      and not exists (
        select 1 from public.payments p
        where p.listing_id = l.id
          and p.status in ('succeeded', 'refunded', 'disputed')
      )
  `;
}
