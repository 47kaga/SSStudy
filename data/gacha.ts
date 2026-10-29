// Game data for the gacha. Starting values: change them here, not in the logic.
import type { GachaData } from "@/lib/gacha";

export const gacha = {
  pullCost: 5, // shards per pull; a starting guess, easy to change
  devGrantShards: 10, // development-only grant amount
} as const;

// Weights are integers out of 100 (checked by validateGachaData).
// Rarity is shown by border weight, pips (small squares) and the color of the item text. `tier` picks the
// text color from rarityPalette in theme/tokens.ts (Terraria's ladder: 0 white, 2 green, 5 pink, 11 purple).
// Super Rare and Ultra Rare (heavyBorder) get a heavy border in their rarity color on the Last pull panel.
export const gachaData: GachaData = {
  rarities: [
    { id: "common", label: "Common", mark: "C", weight: 70, border: "hairline", pips: 1, tier: 0, heavyBorder: false },
    { id: "rare", label: "Rare", mark: "R", weight: 22, border: "medium", pips: 2, tier: 2, heavyBorder: false },
    { id: "super-rare", label: "Super Rare", mark: "SR", weight: 6, border: "heavy", pips: 3, tier: 5, heavyBorder: true },
    { id: "ultra-rare", label: "Ultra Rare", mark: "UR", weight: 2, border: "heavy", pips: 4, tier: 11, heavyBorder: true },
  ],
  // Original placeholder items. Order here is the grid order and the item number shown for unowned cells.
  items: [
    { key: "desk-lamp", name: "Desk Lamp", rarity: "common" },
    { key: "coffee-mug", name: "Coffee Mug", rarity: "common" },
    { key: "highlighter-set", name: "Highlighter Set", rarity: "common" },
    { key: "sticky-notes", name: "Sticky Notes", rarity: "common" },
    { key: "pencil-cup", name: "Pencil Cup", rarity: "common" },
    { key: "paper-clip-chain", name: "Paper Clip Chain", rarity: "common" },
    { key: "lofi-radio", name: "Lo-Fi Radio", rarity: "rare" },
    { key: "window-plant", name: "Window Plant", rarity: "rare" },
    { key: "night-owl-figurine", name: "Night Owl Figurine", rarity: "rare" },
    { key: "study-cat", name: "Study Cat", rarity: "super-rare" },
    { key: "floating-bookshelf", name: "Floating Bookshelf", rarity: "super-rare" },
    { key: "golden-hourglass", name: "Golden Hourglass", rarity: "ultra-rare" },
  ],
};
