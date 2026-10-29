import type { CSSProperties, ReactNode } from "react";
import { itemTextOutline, rarityPalette, type ItemTextSize, type RarityTier } from "@/theme/tokens";

type ItemNameProps = {
  /** Rarity tier: a key of the palette in theme/tokens.ts. */
  tier: number;
  /** `small` for caption-size text (grid names, rarity words), `large` for the Last pull name. */
  size: ItemTextSize;
  /** Text-size classes from the theme, for example "text-title". */
  className?: string;
  children: ReactNode;
};

// Item names and rarity words: bold, in the rarity color, with a dark outline (the .item-text class in
// app/globals.css). The color and the outline width come from the token file; no value is written here.
export function ItemName({ tier, size, className = "", children }: ItemNameProps) {
  const color = rarityPalette[tier as RarityTier];
  if (color === undefined) throw new RangeError(`No rarity color for tier ${tier}.`);
  const outline = itemTextOutline[size];
  const style = { color, letterSpacing: outline.letterSpacing, "--item-stroke": outline.stroke } as CSSProperties;
  return (
    <span className={`item-text font-item ${className}`} style={style}>
      {children}
    </span>
  );
}
