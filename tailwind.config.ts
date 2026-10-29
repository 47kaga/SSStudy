import type { Config } from "tailwindcss";
import { backdropBlur, borderWidth, colors, fontFamily, fontSize, maxWidth, roomSize, spacing } from "./theme/tokens";

// `theme` (not `theme.extend`) replaces Tailwind's defaults, so only token values exist as classes.
// Empty shadow/blur maps remove those utilities entirely. The only blur is the modal backdrop.
const config: Config = {
  theme: {
    colors,
    spacing: { ...spacing, ...roomSize },
    fontFamily,
    fontSize,
    borderWidth,
    borderRadius: {},
    maxWidth,
    boxShadow: {},
    dropShadow: {},
    blur: {},
    backdropBlur,
  },
};

export default config;
