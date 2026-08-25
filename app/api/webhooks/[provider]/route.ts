import { jsonErr, jsonOk } from "@/lib/api-utils";
import {
  SettleError,
  applyProviderEvent,
  type ProviderEventType,
} from "@/lib/settlement";

export const dynamic = "force-dynamic";

/**
 * Provider webhook endpoint:  POST /api/webhooks/{provider}
 *
 * Supported providers:
 *   demo — HMAC-SHA256 over "{t}.{body}", header x-mythic-signature: t=…,v1=…
 *   dodo — Svix scheme (Dodo's standard): headers webhook-id / webhook-timestamp /
 *          webhook-signature ("v1,<base64>"), signed content
 *          "{webhook-id}.{webhook-timestamp}.{body}", secret WEBHOOK_SECRET_DODO.
 *
 * Both are timing-safe compared and carry a ±5 minute replay window. The
 * provider_event_id UNIQUE constraint makes duplicate deliveries no-ops at the
 * ledger regardless of signature validity.
 */

const MAX_SKEW_SECONDS = 300;

interface WebhookEnvelope {
  id?: unknown;
  type?: unknown;
  data?: {
    paymentId?: unknown;
    providerPaymentId?: unknown;
    email?: unknown;
    /** Dodo-style nested payload. */
    metadata?: Record<string, unknown> | null;
    customer?: { email?: string } | null;
    payment_id?: string;
    [k: string]: unknown;
  };
}

/* --------------------------- verification ---------------------------- */

async function timingSafeEqualHex(a: string, b: string): Promise<boolean> {
  const { timingSafeEqual } = await import("node:crypto");
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

async function verifyDemoSignature(
  rawBody: string,
  header: string | null,
  secret: string | null
): Promise<boolean> {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=").map((s) => s.trim()) as [string, string])
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > MAX_SKEW_SECONDS) return false;

  const { createHmac } = await import("node:crypto");
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return timingSafeEqualHex(expected, v1);
}

/** Dodo uses Svix webhook signing. */
async function verifySvixSignature(
  rawBody: string,
  headers: Headers,
  secret: string | null
): Promise<boolean> {
  if (!secret) return false;
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - tsNum) > MAX_SKEW_SECONDS) return false;

  // Secrets arrive as "whsec_<base64>"; strip the prefix, decode.
  const keyB64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = Buffer.from(keyB64, "base64");

  const { createHmac } = await import("node:crypto");
  const expected =
    "v1," +
    createHmac("sha256", key).update(`${id}.${ts}.${rawBody}`).digest("base64");

  // Svix may send multiple space-separated signatures; any match passes.
  for (const candidate of sigHeader.split(" ").map((s) => s.trim()).filter(Boolean)) {
    if (await timingSafeEqualHex(expected, candidate)) return true;
  }
  return false;
}

function secretFor(provider: string): string | null {
  const key = `WEBHOOK_SECRET_${provider.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return process.env[key] ?? process.env.WEBHOOK_SECRET_DEMO ?? null;
}

/* ------------------------------ mapping ------------------------------ */

const INTERNAL_TYPES: ReadonlySet<string> = new Set([
  "payment.succeeded",
  "payment.failed",
  "payment.refunded",
  "payment.disputed",
]);

/** Dodo event type → our settlement event type (undefined = ignore politely). */
const DODO_TYPE_MAP: Record<string, ProviderEventType> = {
  "payment.succeeded": "payment.succeeded",
  "payment.failed": "payment.failed",
  "refund.succeeded": "payment.refunded",
  "dispute.indicator": "payment.disputed",
};

interface NormalizedEvent {
  eventId: string;
  type: ProviderEventType;
  paymentId?: string;
  providerPaymentId?: string;
  email?: string;
}

function normalizeEnvelope(
  provider: string,
  envelope: WebhookEnvelope
): NormalizedEvent | null {
  const rawType = typeof envelope.type === "string" ? envelope.type : "";
  const rawId = typeof envelope.id === "string" ? envelope.id : "";

  if (!rawType) return null;

  /* Demo / internal envelope: { id, type: "payment.x", data: { paymentId } } */
  if (INTERNAL_TYPES.has(rawType)) {
    return {
      eventId: `${provider}:${rawId}`,
      type: rawType as ProviderEventType,
      paymentId:
        typeof envelope.data?.paymentId === "string"
          ? envelope.data.paymentId
          : undefined,
      providerPaymentId:
        typeof envelope.data?.providerPaymentId === "string"
          ? envelope.data.providerPaymentId
          : undefined,
      email:
        typeof envelope.data?.email === "string" ? envelope.data.email : undefined,
    };
  }

  /* Dodo envelope: { id, type: "payment.succeeded"|…, data: { metadata, … } } */
  if (provider === "dodo") {
    const mapped = DODO_TYPE_MAP[rawType];
    if (!mapped) return null; // unknown-but-valid → ack without action

    const meta = (envelope.data?.metadata ?? {}) as Record<string, unknown>;
    const fromMeta =
      typeof meta.payment_id === "string" ? meta.payment_id : undefined;

    return {
      eventId: `${provider}:${rawId}`,
      type: mapped,
      paymentId: fromMeta,
      providerPaymentId:
        typeof envelope.data?.payment_id === "string"
          ? envelope.data.payment_id
          : undefined,
      email:
        typeof envelope.data?.customer?.email === "string"
          ? envelope.data.customer.email
          : undefined,
    };
  }

  return null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const rawBody = await req.text();

  const valid =
    provider === "dodo"
      ? await verifySvixSignature(rawBody, req.headers, secretFor(provider))
      : await verifyDemoSignature(rawBody, req.headers.get("x-mythic-signature"), secretFor(provider));

  if (!valid) {
    // Non-2xx tells the provider to retry; a bad signature never improves.
    return jsonErr("Invalid webhook signature.", 401);
  }

  let envelope: WebhookEnvelope;
  try {
    envelope = JSON.parse(rawBody) as WebhookEnvelope;
  } catch {
    return jsonErr("Malformed JSON.", 400);
  }
  if (typeof envelope.id !== "string" || envelope.id.length === 0) {
    return jsonErr("Missing event id.", 400);
  }

  const event = normalizeEnvelope(provider, envelope);
  if (!event) {
    // Well-formed but not applicable — always 2xx so providers stop retrying.
    return jsonOk({ processed: false, reason: "ignored_event_type" });
  }

  try {
    const result = await applyProviderEvent({
      id: event.eventId,
      type: event.type,
      data: {
        paymentId: event.paymentId,
        providerPaymentId: event.providerPaymentId,
        email: event.email,
      },
      payload: { receivedAt: new Date().toISOString() },
    });

    return jsonOk({
      processed: result.processed,
      alreadyProcessed: result.alreadyProcessed,
      status: result.status,
      rank: result.rank,
    });
  } catch (err) {
    if (err instanceof SettleError && err.status === 404) {
      return jsonOk({ processed: false, reason: "unknown_payment" });
    }
    // Transient failure (DB down, deadlock): signal retry.
    return jsonErr("Webhook processing failed; retry.", 500);
  }
}
