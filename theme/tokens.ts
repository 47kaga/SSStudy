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

export const fontFamily = {
  sans: ["system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
};

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
} as const;

export const tokens = { colors, spacing, fontFamily, fontSize, borderWidth, maxWidth } as const;
