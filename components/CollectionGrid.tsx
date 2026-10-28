import { Pips } from "@/components/Pips";
import { gachaData } from "@/data/gacha";
import type { OwnedItem } from "@/lib/inventory";

// Rarity is shown by border weight and pips only. Full class names so Tailwind can see them.
const BORDER = { hairline: "border-hairline", medium: "border-medium", heavy: "border-heavy" } as const;

function itemNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

// No artwork yet: every item is a flat square. Unowned items show only their number, so neither the
// name nor the rarity of something you have not pulled is revealed.
export function CollectionGrid({ owned }: { owned: OwnedItem[] }) {
  const counts = new Map(owned.map((entry) => [entry.itemKey, entry.count]));

  return (
    <div className="grid grid-cols-3 border-l-hairline border-t-hairline border-ink md:grid-cols-6">
      {gachaData.items.map((item, index) => {
        const count = counts.get(item.key);
        const rarity = gachaData.rarities.find((entry) => entry.id === item.rarity);
        // Content-height cells: a long name makes the whole row taller instead of being clipped.
        const cell = "relative flex min-w-0 flex-col gap-1 border-b-hairline border-r-hairline border-ink p-2";

        if (count === undefined || !rarity) {
          return (
            <div key={item.key} className={cell} aria-label={`Item ${itemNumber(index)}, not owned`}>
              <span className="text-label tabular-nums">{itemNumber(index)}</span>
              <div className="flex flex-1 items-center justify-center">
                <div className="h-12 w-12 bg-ink md:h-16 md:w-16" />
              </div>
            </div>
          );
        }

        return (
          <div
            key={item.key}
            className={cell}
            aria-label={`${item.name}, ${rarity.label} (${rarity.mark}), owned ${count}`}
          >
            <div className="flex items-start justify-between">
              <span className="text-label tabular-nums">{itemNumber(index)}</span>
              <Pips count={rarity.pips} tone={rarity.accent ? "accent" : "ink"} />
            </div>
            <div className="flex flex-1 items-center justify-center">
              <div className={`h-12 w-12 border-ink bg-background md:h-16 md:w-16 ${BORDER[rarity.border]}`} />
            </div>
            <div className="flex items-end justify-between gap-1">
              <p className="min-w-0 wrap-anywhere text-caption">{item.name}</p>
              {count > 1 ? <span className="shrink-0 text-caption tabular-nums">x{count}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
