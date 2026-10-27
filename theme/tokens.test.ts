import { describe, expect, it } from "vitest";
import { borderWidth, colors, spacing } from "./tokens";

describe("design tokens", () => {
  it("defines exactly three colors", () => {
    expect(Object.keys(colors).sort()).toEqual(["accent", "background", "ink"]);
  });

  it("uses flat hex values only", () => {
    for (const value of Object.values(colors)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("keeps spacing on the 4px grid and borders to hairline and heavy", () => {
    for (const value of Object.values(spacing)) {
      expect(parseInt(value, 10) % 4).toBe(0);
    }
    expect(Object.keys(borderWidth)).toEqual(["hairline", "heavy"]);
  });
});
