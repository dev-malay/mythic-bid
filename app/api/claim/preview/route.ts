import { getClientIp, jsonErr, jsonOk, readJsonBody } from "@/lib/api-utils";
import { evaluateClaim } from "@/lib/claims";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface PreviewBody {
  target?: unknown;
  amount?: unknown;
  category?: unknown;
  takeover?: unknown;
}

/** Live "what rank would this get me?" estimates as the user types. */
export async function POST(req: Request) {
  const gate = rateLimit(`preview:${getClientIp(req)}`, 40, 60_000);
  if (!gate.ok) return jsonErr("Slow down a moment.", 429);

  const body = await readJsonBody<PreviewBody>(req);
  if (!body) return jsonErr("Malformed request.", 400);

  const result = await evaluateClaim(
    {
      target: body.target,
      amount: body.amount,
      category: body.category,
      takeover: body.takeover,
    },
    { resolveTitles: false }
  );

  if (!result.ok) {
    return jsonOk(result); // validation feedback is still a successful preview
  }

  const { claim: _claim, ...preview } = result;
  return jsonOk(preview);
}
