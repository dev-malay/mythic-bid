import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db";

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

  const listing = sqlite
    .prepare("SELECT url, handle, target_type FROM listings WHERE id = ?")
    .get(id) as
    | { url: string | null; handle: string | null; target_type: "url" | "handle" }
    | undefined;

  if (!listing) {
    return NextResponse.redirect(new URL("/", _req.url), 302);
  }

  sqlite.prepare("UPDATE listings SET clicks = clicks + 1 WHERE id = ?").run(id);

  const destination =
    listing.target_type === "handle" && listing.handle
      ? `https://x.com/${listing.handle.replace(/^@/, "")}`
      : listing.url ?? "/";

  return NextResponse.redirect(destination, 302);
}
