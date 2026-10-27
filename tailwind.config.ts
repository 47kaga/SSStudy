import type { Config } from "tailwindcss";
import { borderWidth, colors, fontFamily, fontSize, maxWidth, spacing } from "./theme/tokens";

// `theme` (not `theme.extend`) replaces Tailwind's defaults, so only token values exist as classes.
// Empty shadow/blur maps remove those utilities entirely.
const config: Config = {
  theme: {
    colors,
    spacing,
    fontFamily,
    fontSize,
    borderWidth,
    maxWidth,
    boxShadow: {},
    dropShadow: {},
    blur: {},
    backdropBlur: {},
  },
};

export default config;
