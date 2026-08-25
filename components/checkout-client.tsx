"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  Loader2,
  Lock,
  Share2,
} from "lucide-react";
import { BrandMark } from "@/components/site-header";
import { fmtUSD } from "@/lib/format";

type Kind = "initial" | "raise" | "takeover";

interface Props {
  mode: "pay" | "done" | "dead" | "waiting";
  paymentId?: string;
  amountCents: number;
  kind: Kind;
  targetLabel: string;
  existingName?: string;
  result?: { rank: number };
}

const KIND_LABEL: Record<Kind, string> = {
  initial: "New spot on the board",
  raise: "Bid raise",
  takeover: "Front-page takeover · 3 hours",
};

/**
 * Demo checkout. Card data is validated locally (Luhn, expiry, CVC) but only
 * `brand` + `last4` ever reach the server — the same trust boundary a real
 * tokenized integration (Stripe Elements, Polar Checkout) would enforce.
 */
export function CheckoutClient({
  mode,
  paymentId,
  amountCents,
  kind,
  targetLabel,
  existingName,
  result,
}: Props) {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col justify-center px-4 py-14">
      <div className="mb-6 flex items-center justify-center gap-2.5">
        <BrandMark size={22} />
        <span className="text-sm font-semibold tracking-tight">
          Mythic<span className="text-gold">Bid</span> Checkout
        </span>
      </div>

      {mode === "pay" && paymentId && (
        <PayPanel
          paymentId={paymentId}
          amountCents={amountCents}
          kind={kind}
          targetLabel={targetLabel}
          existingName={existingName}
        />
      )}
      {mode === "waiting" && paymentId && (
        <WaitingPanel
          paymentId={paymentId}
          amountCents={amountCents}
          targetLabel={targetLabel}
        />
      )}
      {mode === "done" && result && (
        <DonePanel
          amountCents={amountCents}
          kind={kind}
          targetLabel={targetLabel}
          rank={result.rank}
        />
      )}
      {mode === "dead" && <DeadPanel />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pay                                                                 */
/* ------------------------------------------------------------------ */

function PayPanel({
  paymentId,
  amountCents,
  kind,
  targetLabel,
  existingName,
}: {
  paymentId: string;
  amountCents: number;
  kind: Kind;
  targetLabel: string;
  existingName?: string;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "processing" | "error">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const brand = useMemo(() => detectBrand(cardNumber.replace(/\s/g, "")), [cardNumber]);

  function setNum(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, brand === "amex" ? 15 : 16);
    setCardNumber(groupDigits(digits, brand === "amex" ? [4, 6, 5] : [4, 4, 4, 4]));
  }

  function setExp(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors = validate({ cardNumber, expiry, cvc, name });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setStatus("processing");
    setServerError(null);

    try {
      // Simulated processor latency for an honest interaction rhythm.
      await new Promise((r) => setTimeout(r, 1600));
      const digits = cardNumber.replace(/\s/g, "");
      const res = await fetch(`/api/checkout/${paymentId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: brand ?? "unknown",
          last4: digits.slice(-4),
          email: email.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        rank?: number;
      };
      if (!data.ok) {
        setStatus("error");
        setServerError(data.error ?? "Payment failed.");
        return;
      }
      window.location.reload(); // server re-renders the settled state
    } catch {
      setStatus("error");
      setServerError("Network error — no charge was made. Try again.");
    }
  }

  const busy = status === "processing";

  return (
    <div className="panel p-6 sm:p-7">
      {/* Order summary */}
      <div className="panel-inset mb-6 px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">
          {KIND_LABEL[kind]}
        </p>
        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-[15px] font-medium">
            {existingName ? (
              <>
                {existingName}{" "}
                <span className="text-dim">· {targetLabel}</span>
              </>
            ) : (
              targetLabel
            )}
          </p>
          <p className="num shrink-0 text-xl font-semibold text-gold-strong">
            {fmtUSD(amountCents)}
          </p>
        </div>
        {kind === "raise" && (
          <p className="mt-1 text-xs text-mute">
            You pay only the difference between your new level and your current
            bid.
          </p>
        )}
      </div>

      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={busy} className="space-y-4">
          <div>
            <label htmlFor="cc-name" className="label-xs">Name on card</label>
            <input
              id="cc-name"
              className="input"
              autoComplete="cc-name"
              placeholder="Ada Lovelace"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {fieldErrors.name && <FieldError msg={fieldErrors.name} />}
          </div>

          <div>
            <label htmlFor="cc-number" className="label-xs">Card number</label>
            <div className="relative">
              <CreditCard
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim"
                aria-hidden="true"
              />
              <input
                id="cc-number"
                className="input num pl-9 pr-20"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="4242 4242 4242 4242"
                value={cardNumber}
                onChange={(e) => setNum(e.target.value)}
              />
              {brand && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-mute">
                  {brand}
                </span>
              )}
            </div>
            {fieldErrors.cardNumber && <FieldError msg={fieldErrors.cardNumber} />}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cc-exp" className="label-xs">Expiry</label>
              <input
                id="cc-exp"
                className="input num"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => setExp(e.target.value)}
              />
              {fieldErrors.expiry && <FieldError msg={fieldErrors.expiry} />}
            </div>
            <div>
              <label htmlFor="cc-cvc" className="label-xs">CVC</label>
              <input
                id="cc-cvc"
                className="input num"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                maxLength={4}
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, ""))}
              />
              {fieldErrors.cvc && <FieldError msg={fieldErrors.cvc} />}
            </div>
          </div>

          <div>
            <label htmlFor="cc-email" className="label-xs">
              Email for receipt <span className="normal-case tracking-normal text-dim">(optional)</span>
            </label>
            <input
              id="cc-email"
              className="input"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </fieldset>

        {serverError && (
          <p role="alert" className="mt-4 flex items-center gap-2 rounded-[10px] border border-bad/30 bg-bad/5 px-3 py-2.5 text-[13px] text-bad">
            <AlertTriangle size={14} aria-hidden="true" />
            {serverError}
          </p>
        )}

        <button type="submit" className="btn btn-primary mt-6 w-full text-[15px]" disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={15} className="spinner" aria-hidden="true" />
              Processing…
            </>
          ) : (
            <>
              <Lock size={13} aria-hidden="true" />
              Pay {fmtUSD(amountCents)}
            </>
          )}
        </button>
      </form>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-dim">
        <ShieldIcon />
        Demo checkout — use 4242 4242 4242 4242 with any future date. No real
        charge is made.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Done                                                                */
/* ------------------------------------------------------------------ */

function DonePanel({
  amountCents,
  kind,
  targetLabel,
  rank,
}: {
  amountCents: number;
  kind: Kind;
  targetLabel: string;
  rank: number;
}) {
  const shareText = encodeURIComponent(
    `I just ${kind === "takeover" ? "bought the front page of" : "claimed"} Mythic Bid at #${rank} for ${fmtUSD(amountCents)} — rank is the bid.`
  );

  return (
    <div className="panel rise-in p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-good/40 bg-good/10">
        <BadgeCheck size={26} className="text-good" aria-hidden="true" />
      </div>

      <h1 className="mt-5 text-lg font-semibold tracking-tight">Payment complete</h1>

      <p className="num mt-6 text-6xl font-bold tracking-tight text-gold-strong">
        #{rank}
      </p>
      <p className="mt-1 text-sm text-mute">
        {kind === "raise" ? "Raised" : kind === "takeover" ? "Spotlight locked for" : "Claimed"} —{" "}
        {fmtUSD(amountCents)} · {targetLabel}
      </p>

      <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href="/" className="btn btn-primary">
          View the board
        </Link>
        <a
          className="btn btn-secondary"
          href={`https://x.com/intent/tweet?text=${shareText}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Share2 size={14} aria-hidden="true" />
          Share
        </a>
      </div>

      <p className="mt-6 text-xs text-dim">
        Anyone can outbid you at any time. Watch your rank from the board.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Waiting (hosted-checkout return; webhook in flight)                 */
/* ------------------------------------------------------------------ */

function WaitingPanel({
  paymentId,
  amountCents,
  targetLabel,
}: {
  paymentId: string;
  amountCents: number;
  targetLabel: string;
}) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/${paymentId}/status`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { status?: string };
        if (data.status === "succeeded") {
          clearInterval(timer);
          window.location.reload(); // server re-renders the settled view
        }
      } catch {
        /* keep polling */
      }
      if (Date.now() - started > 90_000) {
        clearInterval(timer);
        setTimedOut(true);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [paymentId]);

  return (
    <div className="panel p-8 text-center">
      <Loader2 size={30} className="mx-auto spinner text-gold" aria-hidden="true" />
      <h1 className="mt-5 text-lg font-semibold tracking-tight">
        {timedOut ? "Still confirming…" : "Confirming your payment"}
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-mute">
        {timedOut
          ? "The provider hasn't confirmed yet — this usually takes a minute. Your spot claims automatically the moment the webhook lands. Refresh anytime."
          : `We're waiting for the signed confirmation for ${fmtUSD(amountCents)} · ${targetLabel}. The page updates itself.`}
      </p>
      <Link href="/" className="btn btn-secondary mt-6">
        <ArrowLeft size={14} aria-hidden="true" />
        Back to the board
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dead checkout                                                       */
/* ------------------------------------------------------------------ */

function DeadPanel() {
  return (
    <div className="panel p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-line bg-panel-2">
        <AlertTriangle size={24} className="text-mute" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-lg font-semibold tracking-tight">
        This checkout is closed
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-mute">
        It expired after 30 minutes or was already used. Nothing was charged.
        Start a fresh claim to get back on the board.
      </p>
      <Link href="/" className="btn btn-secondary mt-6">
        <ArrowLeft size={14} aria-hidden="true" />
        Back to the board
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card helpers                                                        */
/* ------------------------------------------------------------------ */

function FieldError({ msg }: { msg: string }) {
  return <p className="mt-1.5 text-xs text-bad">{msg}</p>;
}

function ShieldIcon() {
  return <Lock size={11} aria-hidden="true" />;
}

function groupDigits(digits: string, groups: number[]): string {
  const out: string[] = [];
  let i = 0;
  for (const g of groups) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + g));
    i += g;
  }
  if (i < digits.length) out.push(digits.slice(i));
  return out.join(" ");
}

function detectBrand(digits: string): string | null {
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^6(?:011|5)/.test(digits)) return "discover";
  return digits.length >= 1 ? "card" : null;
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function validate(input: {
  cardNumber: string;
  expiry: string;
  cvc: string;
  name: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const digits = input.cardNumber.replace(/\s/g, "");

  if (!input.name.trim()) errors.name = "Required.";
  if (digits.length < 13 || digits.length > 19 || !luhnValid(digits)) {
    errors.cardNumber = "That card number doesn't check out.";
  }
  const m = input.expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!m) {
    errors.expiry = "Use MM/YY.";
  } else {
    const month = parseInt(m[1] ?? "0", 10);
    const year = 2000 + parseInt(m[2] ?? "0", 10);
    const now = new Date();
    const endOfMonth = new Date(year, month, 1);
    if (month < 1 || month > 12 || endOfMonth <= now) {
      errors.expiry = "Card is expired.";
    }
  }
  if (input.cvc.length < 3) errors.cvc = "3–4 digits.";
  return errors;
}
