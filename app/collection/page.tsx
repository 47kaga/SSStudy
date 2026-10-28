import { connection } from "next/server";
import { CollectionGrid } from "@/components/CollectionGrid";
import { Divider } from "@/components/Divider";
import { PullPanel } from "@/components/PullPanel";
import { Screen } from "@/components/Screen";
import { gacha, gachaData } from "@/data/gacha";
import { listInventory } from "@/lib/inventory";
import { devToolsEnabled, getBalance } from "@/lib/shards";

export default async function CollectionPage() {
  // Per-request data: never prerender this page at build time.
  await connection();

  const [balance, owned] = await Promise.all([getBalance(), listInventory()]);
  return (
    <Screen>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-title">Collection</h1>
        <p className="shrink-0 text-caption tabular-nums">
          Collected {owned.length} / {gachaData.items.length}
        </p>
      </div>
      <Divider weight="heavy" />
      <PullPanel
        balance={balance}
        pullCost={gacha.pullCost}
        devTools={devToolsEnabled()}
        devGrantShards={gacha.devGrantShards}
      />
      <CollectionGrid owned={owned} />
    </Screen>
  );
}
