/**
 * PostgreSQL data layer (Supabase-compatible).
 *
 * The app talks to Postgres over a standard connection string — point
 * DATABASE_URL at your Supabase project (session pooler URI works best for
 * transactions) and everything below runs unchanged.
 *
 * Concurrency model: every mutation that affects money or ranking runs inside
 * `sql.begin()` with conditional UPDATE guards (`WHERE status='pending'
 * RETURNING id`), so duplicate webhook deliveries and concurrent checkouts
 * can never double-apply.
 */

import postgres from "postgres";

export interface ListingRow {
  id: string;
  target_type: "url" | "handle";
  display_name: string;
  normalized_url: string;
  category_slug: string;
  /** Cents. Materialized SUM(succeeded payments). Ranking basis. */
  current_total: number;
  clicks: number;
  created_at: Date;
  updated_at: Date;
}

export type PaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "refunded"
  | "disputed";
export type PaymentKind = "initial" | "raise" | "takeover";

export interface PaymentRow {
  id: string;
  listing_id: string;
  user_id: string | null;
  provider: string;
  provider_payment_id: string | null;
  provider_checkout_id: string | null;
  amount: number;
  currency: string;
  kind: PaymentKind;
  status: PaymentStatus;
  created_at: Date;
  paid_at: Date | null;
}

export interface PaymentEventRow {
  id: string;
  payment_id: string;
  provider_event_id: string;
  event_type: string;
  payload_json: unknown;
  created_at: Date;
}

export interface TakeoverRow {
  id: string;
  listing_id: string;
  payment_id: string;
  price_amount: number;
  starts_at: Date;
  ends_at: Date;
}

declare global {
  var __mythicSql: postgres.Sql | undefined;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at your Supabase Postgres connection string (Project settings → Database → Connection string)."
    );
  }
  return url;
}

function connect(): postgres.Sql {
  const sql = postgres(connectionString(), {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: false, // pooler-friendly (Supabase pgbouncer transaction mode)
    types: {
      // Return int8 as number — all money math stays inside JS safe range.
      bigint: postgres.BigInt,
    },
  });
  return sql;
}

let instance: postgres.Sql | undefined;

function client(): postgres.Sql {
  if (!instance) {
    // Survives dev-server hot reloads.
    instance = globalThis.__mythicSql ?? undefined;
    if (!instance) {
      instance = connect();
      globalThis.__mythicSql = instance;
    }
  }
  return instance;
}

/**
 * Lazy SQL client: importing this module never opens a connection (so
 * build-time page-data collection stays database-free); the first real query
 * connects. The callable Proxy keeps `sql` usable both as a template tag
 * (`sql`select …``) and as an object (`sql.begin`, `sql.unsafe`, …).
 */
export const sql: postgres.Sql = new Proxy(
  function sqlTag() {} as unknown as postgres.Sql,
  {
    apply(_target, _thisArg, args) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (client() as any)(...(args as any[]));
    },
    get(_target, prop) {
      const c = client();
      const value = Reflect.get(c, prop) as unknown;
      return typeof value === "function" ? value.bind(c) : value;
    },
  }
);

/** Client type for scripts and helpers. */
export type SqlClient = postgres.Sql;

/* ------------------------------------------------------------------ */
/* Schema bootstrap                                                    */
/* ------------------------------------------------------------------ */

let schemaReady = false;

/**
 * Idempotently applies the canonical migration so the app self-heals against
 * an empty database. In production, prefer running the files in supabase/
 * migrations via the Supabase CLI; this guard simply keeps dev/test friction
 * at zero.
 */
export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await sql.unsafe(`
    create extension if not exists pgcrypto;

    create table if not exists public.users (
      id          uuid primary key default gen_random_uuid(),
      email       text not null unique,
      created_at  timestamptz not null default now()
    );

    create table if not exists public.listings (
      id              uuid primary key default gen_random_uuid(),
      normalized_url  text not null unique,
      target_type     text not null default 'url' check (target_type in ('url','handle')),
      display_name    text not null,
      current_total   bigint not null default 0 check (current_total >= 0),
      category_slug   text not null default 'other',
      clicks          integer not null default 0,
      created_at      timestamptz not null default now(),
      updated_at      timestamptz not null default now()
    );
    create index if not exists idx_listings_rank on public.listings (current_total desc, created_at asc);
    create index if not exists idx_listings_category on public.listings (category_slug);

    create table if not exists public.payments (
      id                   uuid primary key default gen_random_uuid(),
      listing_id           uuid not null references public.listings(id),
      user_id              uuid references public.users(id),
      provider             text not null default 'demo',
      provider_payment_id  text,
      provider_checkout_id text,
      amount               bigint not null check (amount > 0),
      currency             text not null default 'usd',
      kind                 text not null default 'raise' check (kind in ('initial','raise','takeover')),
      status               text not null default 'pending' check (status in ('pending','succeeded','failed','refunded','disputed')),
      created_at           timestamptz not null default now(),
      paid_at              timestamptz
    );
    create index if not exists idx_payments_listing on public.payments (listing_id, status);
    create index if not exists idx_payments_paid_at on public.payments (status, paid_at desc);
    create unique index if not exists uq_payments_provider_payment on public.payments (provider, provider_payment_id)
      where provider_payment_id is not null;

    create table if not exists public.payment_events (
      id                 uuid primary key default gen_random_uuid(),
      payment_id         uuid not null references public.payments(id),
      provider_event_id  text not null unique,
      event_type         text not null,
      payload_json       jsonb not null default '{}'::jsonb,
      created_at         timestamptz not null default now()
    );
    create index if not exists idx_events_payment on public.payment_events (payment_id);

    create table if not exists public.takeovers (
      id           uuid primary key default gen_random_uuid(),
      listing_id   uuid not null references public.listings(id) on delete cascade,
      payment_id   uuid references public.payments(id),
      price_amount bigint not null,
      starts_at    timestamptz not null default now(),
      ends_at      timestamptz not null
    );
    create index if not exists idx_takeovers_ends on public.takeovers (ends_at desc);

    create table if not exists public.visits (
      visitor_id    text primary key,
      first_seen_at timestamptz not null default now()
    );

    create table if not exists public.meta (
      key   text primary key,
      value text not null
    );
  `);
  await sql`
    insert into public.meta (key, value)
    values ('launch_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    on conflict (key) do nothing
  `;
  schemaReady = true;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

export function getMeta(key: string): Promise<string | null> {
  return (async () => {
    const rows = await sql`select value from public.meta where key = ${key}`;
    return rows[0]?.value ?? null;
  })();
}

export function setMeta(key: string, value: string): Promise<void> {
  return (async () => {
    await sql`
      insert into public.meta (key, value) values (${key}, ${value})
      on conflict (key) do update set value = excluded.value
    `;
  })();
}
