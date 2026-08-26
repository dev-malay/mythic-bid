import { NextResponse } from "next/server";

export function jsonOk<T extends object>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(
    { ok: true, ...data },
    {
      ...init,
      headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
    }
  );
}

export function jsonErr(
  error: string,
  status = 400,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    { ok: false, error, ...extra },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "local";
}

/** Parse a JSON body safely; returns null on malformed input. */
export async function readJsonBody<T>(req: Request): Promise<T | null> {
  try {
    const body = (await req.json()) as T;
    if (!body || typeof body !== "object") return null;
    return body;
  } catch {
    return null;
  }
}
