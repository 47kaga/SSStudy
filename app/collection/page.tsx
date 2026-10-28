import { connection } from "next/server";
import { CollectionGrid } from "@/components/CollectionGrid";
import { Divider } from "@/components/Divider";
import { PullPanel } from "@/components/PullPanel";
import { Screen } from "@/components/Screen";
import { listInventory } from "@/lib/inventory";
import { devToolsEnabled, getBalance } from "@/lib/shards";

export default async function CollectionPage() {
  // Per-request data: never prerender this page at build time.
  await connection();

  const [balance, owned] = await Promise.all([getBalance(), listInventory()]);
  return (
    <Screen>
      <h1 className="text-title">Collection</h1>
      <Divider weight="heavy" />
      <PullPanel balance={balance} devTools={devToolsEnabled()} />
      <CollectionGrid owned={owned} />
    </Screen>
  );
}
