import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Outbound click tracker. Every board row links through here so public click
 * counts stay honest. URLs are stored pre-sanitized (no query params), so
 * tracking parameters never leak to the destination.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureSchema();

  const rows = await sql`
    update public.listings
       set clicks = clicks + 1
     where id = ${id}
    returning normalized_url, target_type
  `;
  const listing = rows[0] as
    | { normalized_url: string; target_type: "url" | "handle" }
    | undefined;

  if (!listing) {
    return NextResponse.redirect(new URL("/", _req.url), 302);
  }

  return NextResponse.redirect(listing.normalized_url, 302);
}
