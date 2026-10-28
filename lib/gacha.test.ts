import { describe, expect, it } from "vitest";
import { gachaData } from "@/data/gacha";
import { pickWeighted, pullDisplay, rollPull, validateGachaData, type GachaData, type RandomInt } from "./gacha";

/** Small deterministic PRNG, so the distribution test is repeatable and cannot be flaky. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRandomInt(seed: number): RandomInt {
  const random = mulberry32(seed);
  return (max) => Math.floor(random() * max);
}

/** Returns the given rolls in order, then 0. */
function scripted(...rolls: number[]): RandomInt {
  let next = 0;
  return () => rolls[next++] ?? 0;
}

const rarityOf = (key: string) => gachaData.items.find((item) => item.key === key)?.rarity;

describe("pickWeighted", () => {
  const entries = [
    { value: "a", weight: 2 },
    { value: "b", weight: 3 },
    { value: "c", weight: 1 },
  ];

  it("owns exactly weight-many consecutive rolls per entry", () => {
    const picks = Array.from({ length: 6 }, (_, roll) => pickWeighted(entries, scripted(roll)));
    expect(picks).toEqual(["a", "a", "b", "b", "b", "c"]);
  });

  it("asks for a roll over the exact total weight", () => {
    let asked = 0;
    pickWeighted(entries, (max) => {
      asked = max;
      return 0;
    });
    expect(asked).toBe(6);
  });

  it("rejects empty entries", () => {
    expect(() => pickWeighted([], scripted(0))).toThrow(RangeError);
  });

  it("rejects zero, negative and non-integer weights", () => {
    for (const weight of [0, -1, 1.5, Number.NaN]) {
      expect(() => pickWeighted([{ value: "a", weight }], scripted(0))).toThrow(RangeError);
    }
  });

  it("rejects a random source that returns a roll outside the range", () => {
    for (const roll of [-1, 6, 2.5, Number.NaN]) {
      expect(() => pickWeighted(entries, scripted(roll))).toThrow(RangeError);
    }
  });
});

describe("rollPull: rarity boundaries", () => {
  const cases: [number, number, string][] = [
    [0, 0, "common"],
    [69, 0, "common"],
    [70, 0, "rare"],
    [91, 0, "rare"],
    [92, 0, "super-rare"],
    [97, 0, "super-rare"],
    [98, 0, "ultra-rare"],
    [99, 0, "ultra-rare"],
  ];

  it.each(cases)("a roll of %i gives the right rarity", (roll, itemRoll, rarity) => {
    const item = rollPull(gachaData, scripted(roll, itemRoll));
    expect(item.rarity).toBe(rarity);
  });

  it("covers every roll from 0 to 99 with the stated rarity bands", () => {
    const bands = Array.from({ length: 100 }, (_, roll) => rollPull(gachaData, scripted(roll, 0)).rarity);
    expect(bands.filter((rarity) => rarity === "common")).toHaveLength(70);
    expect(bands.filter((rarity) => rarity === "rare")).toHaveLength(22);
    expect(bands.filter((rarity) => rarity === "super-rare")).toHaveLength(6);
    expect(bands.filter((rarity) => rarity === "ultra-rare")).toHaveLength(2);
  });

  it("chooses within a rarity by the second roll, in data order", () => {
    expect(rollPull(gachaData, scripted(0, 0)).key).toBe("desk-lamp");
    expect(rollPull(gachaData, scripted(0, 5)).key).toBe("paper-clip-chain");
    expect(rollPull(gachaData, scripted(92, 1)).key).toBe("floating-bookshelf");
    expect(rollPull(gachaData, scripted(99, 0)).key).toBe("golden-hourglass");
  });

  it("asks for the item roll over the size of the chosen rarity only", () => {
    const asked: number[] = [];
    rollPull(gachaData, (max) => {
      asked.push(max);
      return 0;
    });
    expect(asked).toEqual([100, 6]);
  });
});

describe("rollPull: distribution", () => {
  const PULLS = 200_000;
  const TOLERANCE = 0.005; // half a percentage point; about five standard deviations for the 70% bucket

  const counts = new Map<string, number>();
  const rolled = new Map<string, number>();
  const randomInt = seededRandomInt(20261028);
  for (let pull = 0; pull < PULLS; pull += 1) {
    const item = rollPull(gachaData, randomInt);
    counts.set(item.rarity, (counts.get(item.rarity) ?? 0) + 1);
    rolled.set(item.key, (rolled.get(item.key) ?? 0) + 1);
  }

  it.each([
    ["common", 0.7],
    ["rare", 0.22],
    ["super-rare", 0.06],
    ["ultra-rare", 0.02],
  ])("%s lands near its rate", (rarity, expected) => {
    expect(Math.abs((counts.get(rarity) ?? 0) / PULLS - expected)).toBeLessThan(TOLERANCE);
  });

  it("makes every item reachable", () => {
    for (const item of gachaData.items) {
      expect(rolled.get(item.key) ?? 0, item.key).toBeGreaterThan(0);
    }
  });

  it("splits a rarity evenly among its items", () => {
    const commons = gachaData.items.filter((item) => item.rarity === "common");
    const expected = ((counts.get("common") ?? 0) / commons.length);
    for (const item of commons) {
      expect(Math.abs((rolled.get(item.key) ?? 0) - expected) / expected, item.key).toBeLessThan(0.05);
    }
  });
});

describe("the real data", () => {
  it("passes validation", () => {
    expect(() => validateGachaData(gachaData)).not.toThrow();
  });

  it("matches the design: 12 items in the planned rarity counts", () => {
    expect(gachaData.items).toHaveLength(12);
    const count = (rarity: string) => gachaData.items.filter((item) => item.rarity === rarity).length;
    expect([count("common"), count("rare"), count("super-rare"), count("ultra-rare")]).toEqual([6, 3, 2, 1]);
    expect(rarityOf("golden-hourglass")).toBe("ultra-rare");
  });
});

describe("rarity display data", () => {
  it("uses the planned border weight and pips per rarity, with only Ultra Rare in the accent color", () => {
    const shown = Object.fromEntries(
      gachaData.rarities.map((rarity) => [rarity.id, [rarity.border, rarity.pips, rarity.accent]]),
    );
    expect(shown).toEqual({
      common: ["hairline", 1, false],
      rare: ["medium", 2, false],
      "super-rare": ["heavy", 3, false],
      "ultra-rare": ["heavy", 4, true],
    });
  });
});

describe("pullDisplay", () => {
  it("carries the display fields chosen from the rolled item", () => {
    const item = gachaData.items.find((entry) => entry.key === "golden-hourglass")!;
    expect(pullDisplay(gachaData, item, true)).toEqual({
      itemKey: "golden-hourglass",
      name: "Golden Hourglass",
      rarityLabel: "Ultra Rare",
      mark: "UR",
      pips: 4,
      border: "heavy",
      accent: true,
      isNew: true,
    });
  });

  it("throws for an item whose rarity is not in the data", () => {
    expect(() => pullDisplay(gachaData, { key: "x", name: "X", rarity: "mythic" }, false)).toThrow(/unknown rarity/);
  });
});

describe("validateGachaData", () => {
  const valid: GachaData = {
    rarities: [
      { id: "low", label: "Low", mark: "L", weight: 80, border: "hairline", pips: 1, accent: false },
      { id: "high", label: "High", mark: "H", weight: 20, border: "heavy", pips: 4, accent: true },
    ],
    items: [
      { key: "a", name: "A", rarity: "low" },
      { key: "b", name: "B", rarity: "high" },
    ],
  };

  it("accepts valid data", () => {
    expect(() => validateGachaData(valid)).not.toThrow();
  });

  it("rejects a duplicate item key", () => {
    const data = { ...valid, items: [...valid.items, { key: "a", name: "Again", rarity: "high" }] };
    expect(() => validateGachaData(data)).toThrow(/Duplicate item key "a"/);
  });

  it("rejects a rarity with no items", () => {
    const data = { ...valid, items: [valid.items[0]] };
    expect(() => validateGachaData(data)).toThrow(/"high" has no items/);
  });

  it("rejects a non-integer, zero or negative weight", () => {
    for (const weight of [20.5, 0, -20]) {
      const data = { ...valid, rarities: [valid.rarities[0], { ...valid.rarities[1], weight }] };
      expect(() => validateGachaData(data)).toThrow(/weight/);
    }
  });

  it("rejects weights that do not sum to 100", () => {
    const data = { ...valid, rarities: [valid.rarities[0], { ...valid.rarities[1], weight: 21 }] };
    expect(() => validateGachaData(data)).toThrow(/sum to 101/);
  });

  it("rejects an item with an unknown rarity", () => {
    const data = { ...valid, items: [...valid.items, { key: "c", name: "C", rarity: "mythic" }] };
    expect(() => validateGachaData(data)).toThrow(/unknown rarity "mythic"/);
  });

  it("rejects pips outside 1 to 4", () => {
    for (const pips of [0, 5, 2.5, -1]) {
      const data = { ...valid, rarities: [valid.rarities[0], { ...valid.rarities[1], pips }] };
      expect(() => validateGachaData(data)).toThrow(/pips/);
    }
  });

  it("rejects a duplicate rarity id", () => {
    const data = { ...valid, rarities: [valid.rarities[0], { ...valid.rarities[0], weight: 20 }] };
    expect(() => validateGachaData(data)).toThrow(/Duplicate rarity id/);
  });
});
