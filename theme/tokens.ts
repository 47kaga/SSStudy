// Single source of truth for design tokens.
// tailwind.config.ts reads this file; nothing else may define colors, spacing or type sizes.

export const colors = {
  background: "#F6F5F1",
  ink: "#111111",
  accent: "#1F4BD8",
} as const;

// Keys follow Tailwind's convention (unit = 4px), so `p-4` is 16px.
export const spacing = {
  1: "4px",
  2: "8px",
  4: "16px",
  6: "24px",
  8: "32px",
  12: "48px",
  16: "64px",
  24: "96px",
  32: "128px",
} as const;

const systemFonts = ["system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"];

// The pixel room is 160 by 96 logical pixels (10 by 6 tiles of 16). It is shown at a whole-number scale only:
// 2x below the md breakpoint and 4x from md up. Used as spacing keys, so `w-room-phone-w` and friends exist.
export const roomSize = {
  "room-phone-w": "320px",
  "room-phone-h": "192px",
  "room-desktop-w": "640px",
  "room-desktop-h": "384px",
} as const;

export const fontFamily = {
  sans: systemFonts,
  // Item names and rarity words. The same system stack today, so no font file is involved.
  // This is the one place to point item text at a chosen font later.
  item: systemFonts,
};

// Item-text colors by rarity tier, the vanilla Terraria ladder (tiers 0 to 11). These are starting
// values to tune. They are not UI colors: they apply only to item names, rarity words and pips, and each
// is a flat hex. The custom tiers 12 to 15 are left out on purpose (gradients are banned).
export const rarityPalette = {
  0: "#FFFFFF",
  1: "#9696FF",
  2: "#96FF96",
  3: "#FFC896",
  4: "#FF9696",
  5: "#FF96FF",
  6: "#D2A0FF",
  7: "#96FF0A",
  8: "#FFFF0A",
  9: "#05C8FF",
  10: "#FF2864",
  11: "#B428FF",
} as const satisfies Record<number, string>;

export type RarityTier = keyof typeof rarityPalette;

// Outline of item text, by size. The stroke is painted behind the fill, so only half of its width shows
// outside the letters. Small text (caption size) needs a thinner stroke or the letters fill in.
// These are the only place the values live; .item-text in app/globals.css reads the stroke from a variable.
export const itemTextOutline = {
  small: { stroke: "1.5px", letterSpacing: "0.01em" },
  large: { stroke: "3px", letterSpacing: "0em" },
} as const;

export type ItemTextSize = keyof typeof itemTextOutline;

type TextStyle = [size: string, style: { lineHeight: string; letterSpacing?: string; fontWeight?: string }];

export const fontSize = {
  title: ["2rem", { lineHeight: "2.5rem", fontWeight: "600" }],
  body: ["1rem", { lineHeight: "1.5rem" }],
  caption: ["0.8125rem", { lineHeight: "1.25rem" }],
  label: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.08em", fontWeight: "600" }],
} satisfies Record<string, TextStyle>;

export const borderWidth = {
  hairline: "1px",
  medium: "2px",
  heavy: "3px",
} as const;

export const maxWidth = {
  screen: "72rem",
  modal: "28rem",
} as const;

// The one blur in the design: behind a modal dialog, so the page underneath reads as out of focus.
// Used only by components/Modal.tsx (theme/guardrails.test.ts enforces that). No other blur, glow or shadow.
export const backdropBlur = {
  modal: "6px",
} as const;

export const tokens = {
  colors,
  rarityPalette,
  itemTextOutline,
  spacing,
  roomSize,
  fontFamily,
  fontSize,
  borderWidth,
  maxWidth,
  backdropBlur,
} as const;
