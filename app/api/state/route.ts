import { buildStatePayload } from "@/lib/state-payload";
import { jsonOk } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = buildStatePayload();
  return jsonOk(state);
}
