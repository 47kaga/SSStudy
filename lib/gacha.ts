// Pure gacha logic. No React, Next, Prisma or server-only imports, and no data imports:
// the data is passed in, so tests can use the real tables or small broken ones.

export type Rarity = {
  id: string;
  label: string;
  /** Short corner label, for example "SR". */
  mark: string;
  /** Integer weight out of 100. */
  weight: number;
  border: "hairline" | "heavy";
};

export type GachaItem = {
  /** Stable identifier stored in the database. Never rename it once items are owned. */
  key: string;
  name: string;
  /** The id of a rarity in the same data set. */
  rarity: string;
};

export type GachaData = {
  rarities: readonly Rarity[];
  items: readonly GachaItem[];
};

export type WeightedEntry<T> = { value: T; weight: number };

/** Returns an integer in [0, max). In production this is crypto.randomInt. */
export type RandomInt = (max: number) => number;

export const TOTAL_RARITY_WEIGHT = 100;

function assertValidRoll(roll: number, max: number): void {
  if (!Number.isInteger(roll) || roll < 0 || roll >= max) {
    throw new RangeError(`randomInt(${max}) returned ${roll}, which is not an integer in [0, ${max}).`);
  }
}

/**
 * Picks one value by integer weight. Walks the cumulative weights with integer arithmetic only, so the
 * boundaries are exact: weights 70 and 30 own rolls 0 to 69 and 70 to 99.
 */
export function pickWeighted<T>(entries: readonly WeightedEntry<T>[], randomInt: RandomInt): T {
  if (entries.length === 0) throw new RangeError("pickWeighted needs at least one entry.");

  let total = 0;
  for (const entry of entries) {
    if (!Number.isInteger(entry.weight) || entry.weight <= 0) {
      throw new RangeError(`Weights must be positive integers, got ${entry.weight}.`);
    }
    total += entry.weight;
  }

  let roll = randomInt(total);
  assertValidRoll(roll, total);
  for (const entry of entries) {
    if (roll < entry.weight) return entry.value;
    roll -= entry.weight;
  }
  throw new Error("Unreachable: the roll was inside the total weight.");
}

/** Picks a rarity by weight, then an item of that rarity with equal chance. */
export function rollPull(data: GachaData, randomInt: RandomInt): GachaItem {
  const rarity = pickWeighted(
    data.rarities.map((entry) => ({ value: entry, weight: entry.weight })),
    randomInt,
  );
  const pool = data.items.filter((item) => item.rarity === rarity.id);
  if (pool.length === 0) throw new Error(`No items of rarity "${rarity.id}".`);

  const index = randomInt(pool.length);
  assertValidRoll(index, pool.length);
  return pool[index];
}

/** Throws a clear error if the data cannot be pulled from correctly. */
export function validateGachaData(data: GachaData): void {
  const rarityIds = new Set<string>();
  let totalWeight = 0;
  for (const rarity of data.rarities) {
    if (rarityIds.has(rarity.id)) throw new Error(`Duplicate rarity id "${rarity.id}".`);
    rarityIds.add(rarity.id);
    if (!Number.isInteger(rarity.weight) || rarity.weight <= 0) {
      throw new Error(`Rarity "${rarity.id}" has weight ${rarity.weight}; weights must be positive integers.`);
    }
    totalWeight += rarity.weight;
  }
  if (totalWeight !== TOTAL_RARITY_WEIGHT) {
    throw new Error(`Rarity weights sum to ${totalWeight}, expected ${TOTAL_RARITY_WEIGHT}.`);
  }

  const keys = new Set<string>();
  for (const item of data.items) {
    if (keys.has(item.key)) throw new Error(`Duplicate item key "${item.key}".`);
    keys.add(item.key);
    if (!rarityIds.has(item.rarity)) throw new Error(`Item "${item.key}" has unknown rarity "${item.rarity}".`);
  }

  for (const rarity of data.rarities) {
    if (!data.items.some((item) => item.rarity === rarity.id)) {
      throw new Error(`Rarity "${rarity.id}" has no items.`);
    }
  }
}
