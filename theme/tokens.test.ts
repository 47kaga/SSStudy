import { describe, expect, it } from "vitest";
import { borderWidth, colors, fontFamily, rarityPalette, spacing } from "./tokens";

describe("design tokens", () => {
  it("defines exactly three colors", () => {
    expect(Object.keys(colors).sort()).toEqual(["accent", "background", "ink"]);
  });

  it("uses flat hex values only", () => {
    for (const value of Object.values(colors)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("keeps spacing on the 4px grid and borders to exactly hairline, medium and heavy", () => {
    for (const value of Object.values(spacing)) {
      expect(parseInt(value, 10) % 4).toBe(0);
    }
    expect(Object.keys(borderWidth)).toEqual(["hairline", "medium", "heavy"]);
    expect(Object.values(borderWidth)).toEqual(["1px", "2px", "3px"]);
  });

  describe("rarityPalette", () => {
    const entries = Object.entries(rarityPalette);

    it("covers tiers 0 to 11, with no custom tiers", () => {
      expect(entries.map(([tier]) => Number(tier))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    it("is flat 6-digit hex values only, so no gradient can be expressed", () => {
      for (const [tier, value] of entries) {
        expect(value, `tier ${tier}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(value, `tier ${tier}`).not.toMatch(/gradient|url|,/i);
      }
    });

    it("keeps item-text colors out of the three UI colors", () => {
      expect(Object.keys(colors)).toHaveLength(3);
    });
  });

  it("sets item text in the system font stack, with no font file", () => {
    expect(fontFamily.item).toEqual(fontFamily.sans);
    expect(fontFamily.item[0]).toBe("system-ui");
  });
});
