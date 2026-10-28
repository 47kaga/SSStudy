import { rarityPalette, type RarityTier } from "@/theme/tokens";

// Rarity as a row of small flat squares in the rarity color, each with a hairline ink outline.
// Built from tokens only: no glyphs, no images.
export function Pips({ count, tier }: { count: number; tier: number }) {
  const color = rarityPalette[tier as RarityTier];
  if (color === undefined) throw new RangeError(`No rarity color for tier ${tier}.`);
  return (
    <span className="flex gap-1" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="h-2 w-2 border-hairline border-ink" style={{ backgroundColor: color }} />
      ))}
    </span>
  );
}
