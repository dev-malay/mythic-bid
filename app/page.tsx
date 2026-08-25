import { HomeClient } from "@/components/home-client";
import { buildStatePayload } from "@/lib/state-payload";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initial = await buildStatePayload();
  return <HomeClient initial={initial} />;
}
