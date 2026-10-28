import { gachaData } from "@/data/gacha";
import type { OwnedItem } from "@/lib/inventory";

// Rarity is shown by border weight and a corner label only. Full class names so Tailwind can see them.
const BORDER = { hairline: "border-hairline", heavy: "border-heavy" } as const;

const ULTRA_RARE_ID = "ultra-rare";

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
        // aspect-square, but a long name may make the cell taller instead of being clipped.
        const cell = "relative flex flex-col gap-1 border-b-hairline border-r-hairline border-ink p-2";

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
          <div key={item.key} className={cell} aria-label={`${item.name}, ${rarity.label}, owned ${count}`}>
            <span className="text-label tabular-nums">{itemNumber(index)}</span>
            <span
              className={`absolute right-1 top-1 text-label ${rarity.id === ULTRA_RARE_ID ? "text-accent" : "text-ink"}`}
            >
              {rarity.mark}
            </span>
            <div className="flex flex-1 items-center justify-center">
              <div className={`h-12 w-12 border-ink bg-background md:h-16 md:w-16 ${BORDER[rarity.border]}`} />
            </div>
            <p className="break-words text-caption">
              {item.name}
              {count > 1 ? ` x${count}` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
