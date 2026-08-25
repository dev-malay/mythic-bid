# Mythic Bid

**The paid leaderboard where rank is the bid.** No ads, no algorithms, no mercy —
pay more than everyone else to stand above them. Get outranked, pay the
difference, climb again.

A production-grade, end-to-end implementation of the pay-to-rank leaderboard
format on **Next.js + Supabase/PostgreSQL**, built around an immutable payment
ledger with webhook-driven, idempotent settlement.

## Quick start

```bash
npm install

# Local development needs zero setup: scripts boot an embedded PostgreSQL
# automatically (port 54329, data under ./data/pg).
npm run db:seed     # seed demo data if the board is empty
npm run db:reset    # wipe + reseed

npm run dev         # http://localhost:3000
```

### Using a real Supabase project

1. Create a project at supabase.com.
2. Apply the schema: run `supabase/migrations/0001_init.sql` in the SQL editor
   (or `supabase db push` via the CLI).
3. Set env (`.env.local`):

```bash
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
WEBHOOK_SECRET_DEMO=whsec_your_secret        # signs /api/webhooks/demo
NEXT_PUBLIC_SITE_URL=https://your-domain.com
PAYMENT_MODE=demo                            # or stripe/paddle once integrated
```

4. `npm run build && npm start`.

Never point `db:reset --fresh` at a live Supabase database — the script
refuses to wipe remote databases by design.

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Standard Next.js lifecycle |
| `npm run lint` / `typecheck` | ESLint (flat) · strict TypeScript |
| `npm run db:seed` | Seed demo data if board is empty |
| `npm run db:reset` | Wipe + reseed (local embedded cluster only) |
| `node scripts/dev-db.cjs` | Run the embedded PostgreSQL standalone |

---

## Architecture: money is a ledger, rank is a materialized view

The core design rule: **payments are immutable financial events; the ranking is
a derived value that can always be rebuilt from the ledger.**

```
user ──> checkout ──> provider ──> SIGNED WEBHOOK
                                      │ verify HMAC + timestamp skew
                                      ▼
                             applyProviderEvent()          lib/settlement.ts
                              1. resolve payment row
                              2. INSERT payment_events      ← UNIQUE(provider_event_id)
                                 (duplicate delivery ⇒ no-op)
                              3. BEGIN
                                   UPDATE payments SET status='succeeded'
                                     WHERE id=? AND status='pending'   ← replay-proof guard
                                   UPDATE listings SET current_total += amount
                                   INSERT takeovers (if takeover kind)
                                 COMMIT
```

- A browser redirect NEVER changes the ranking — only verified events do.
- Duplicate/out-of-order webhooks cannot double-increment: the event id is
  deduplicated at the ledger level AND the status transition is conditional
  (`WHERE status='pending' RETURNING`).
- Refunds/disputes claw spend back off the board inside the same transaction
  (`current_total = greatest(0, current_total - amount)`). A no-refund policy
  does not prevent chargebacks, processor errors, or legally mandated refunds,
  so those states exist in the ledger.
- Late webhooks settle even if the checkout UI expired — real money wins over
  any TTL.
- Reconciliation invariant (verified in testing): for every row,
  `listings.current_total = SUM(payments WHERE status='succeeded')`.

## Schema (supabase/migrations/0001_init.sql)

| Table | Role |
| --- | --- |
| `users` | Optional receipt-email identities; linked from payments |
| `listings` | One row per target. `normalized_url` UNIQUE (race-safe claims). `current_total` is materialized for fast board rendering; rows are hidden while it equals 0 |
| `payments` | Immutable financial events: amount, currency, provider ids, kind (`initial`/`raise`/`takeover`), status (`pending`→`succeeded`/`failed`/`refunded`/`disputed`) |
| `payment_events` | Append-only webhook audit log; UNIQUE `provider_event_id` is the idempotency gate |
| `takeovers` | Front-page spotlight windows (3h), opened by settled takeover payments |
| `visits`, `meta` | Visitor counter and site metadata |

Ranking query (indexed): `ORDER BY current_total DESC, created_at ASC` — equal
totals keep placement order; the older listing ranks higher.

## Business rules (as implemented)

- Whole US dollars, $5 min / $999,999 max. A completed payment places you at
  the highest rank that amount reaches.
- Taking #1 costs ≥ $5 more than the top total. Raising your spot costs the
  difference between the new level and your current total (≥ $1 step).
- Today's board sums payments settled in the trailing 24h; each counts for one
  day, then drops off, and also accrues to all-time totals.
- Front-page takeover: exactly 5× the top total, locks a spotlight for 3 hours;
  the spend lifts your totals like any other payment.
- Targets: product websites or X @handles. Query strings stripped; shorteners,
  chat/invite links, private hosts, and adult content rejected.

`/rules` on the running site renders from the same constants (`lib/config.ts`)
the engine enforces — copy and behavior cannot drift.

## Payment providers

`PAYMENT_MODE=demo` (default) ships a full internal checkout so the loop works
end-to-end without external accounts: card `4242 4242 4242 4242`, any future
expiry, any CVC; cards ending `0002` simulate declines. Demo settlement flows
through the exact same `applyProviderEvent()` pipeline as live money.

Going live with Stripe/Paddle:

1. Implement the integration point in `lib/payments.ts`
   (`createPendingPayment`) to create the hosted checkout session and store
   `provider_checkout_id`.
2. Point the provider's webhook at `POST /api/webhooks/{provider}` and set
   `WEBHOOK_SECRET_{PROVIDER}`. The route verifies
   `x-mythic-signature: t=<unix>,v1=<hex(HMAC-SHA256("{t}.{body}"))>` with a
   5-minute timestamp window, then calls `applyProviderEvent()`.
3. Map provider event types to `payment.succeeded` / `payment.failed` /
   `payment.refunded` / `payment.disputed`.

Card data never touches the server (validated client-side; only brand + last4
are posted) — the same trust boundary as tokenized live integrations.

## API surface

| Endpoint | Purpose |
| --- | --- |
| `GET /api/state` | Board, today board, activity, stats (one payload, 5s client polling) |
| `POST /api/claim/preview` | Live "what rank would I get?" validation while typing |
| `POST /api/claim` | Validate + create listing placeholder + pending payment → checkout URL |
| `POST /api/webhooks/{provider}` | Signed provider events → idempotent settlement |
| `POST /api/checkout/[id]/complete` | Demo processor: emits settlement events |
| `GET /go/[id]` | Click tracker → sanitized outbound redirect |
| `POST /api/ping` | Presence heartbeat + unique visits |

## Security notes

- Strict TypeScript (`noUncheckedIndexedAccess`); ESLint clean; parameterized
  SQL everywhere — no string-built queries.
- Webhook signature verification with timing-safe comparison and replay window.
- Per-IP sliding-window rate limits (claim 8/min, preview 40/min, complete
  10/min, ping 30/min).
- httpOnly visitor cookie; server-side visit dedup.
- Security headers globally (`nosniff`, frame `DENY`, referrer policy,
  permissions policy).
- Checkouts expire after 30 minutes in the UI but a late webhook still settles
  real money; abandoned zero-total placeholder listings are garbage-collected
  after 24h (only if they carry no successful history).
