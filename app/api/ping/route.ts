import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/api-utils";
import { rateLimit } from "@/lib/rate-limit";
import { countOnline, recordVisit, touchPresence } from "@/lib/stats";

export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "mb_vid";

/**
 * Presence heartbeat + unique-visit recorder.
 * The visitor id is minted server-side and kept in an httpOnly cookie so the
 * counter can't be trivially inflated by clearing localStorage.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  // Generous limit: heartbeats fire every ~45s per open tab.
  const gate = rateLimit(`ping:${ip}`, 30, 60_000);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const now = Date.now();
  let visitorId: string | undefined;
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)mb_vid=([A-Za-z0-9_-]+)/);
  if (match?.[1]) visitorId = match[1];

  if (visitorId) {
    touchPresence(visitorId, now);
    recordVisit(visitorId).catch(() => undefined);
  }

  const res = NextResponse.json(
    { ok: true, online: Math.max(countOnline(now), 1) },
    { headers: { "Cache-Control": "no-store" } }
  );

  if (!visitorId) {
    const fresh = crypto.randomUUID();
    res.cookies.set(VISITOR_COOKIE, fresh, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  return res;
}
