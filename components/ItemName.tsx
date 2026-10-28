import type { ReactNode } from "react";
import { rarityPalette, type RarityTier } from "@/theme/tokens";

type ItemNameProps = {
  /** Rarity tier: a key of the palette in theme/tokens.ts. */
  tier: number;
  /** Text-size classes from the theme, for example "text-title". */
  className?: string;
  children: ReactNode;
};

// Item names and rarity words: bold, in the rarity color, with a dark outline (the .item-text class in
// app/globals.css). The color comes from the token file; no color value is written here.
export function ItemName({ tier, className = "", children }: ItemNameProps) {
  const color = rarityPalette[tier as RarityTier];
  if (color === undefined) throw new RangeError(`No rarity color for tier ${tier}.`);
  return (
    <span className={`item-text font-item ${className}`} style={{ color }}>
      {children}
    </span>
  );
}
