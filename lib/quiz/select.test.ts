import { describe, expect, it } from "vitest";
import { checkBalance, lengthSpread } from "./balance";
import { selectBalanced } from "./select";
import type { QuizQuestion } from "./types";

// Fixed here, not read from data/quiz.ts, so these tests describe the rules and not today's config.
const limits = { maxOptionLengthRatio: 2, shortOptionExemptChars: 20, maxLengthTellQuestions: 1, questionCount: 3 };

/** One-word options of exact character lengths. Word counts are all 1. */
function question(id: string, lengths: number[], correctIndex: number): QuizQuestion {
  return {
    question: id,
    options: lengths.map((length, index) => String.fromCharCode(97 + index).repeat(length)),
    correctIndex,
  };
}

/** Words of the given letter counts joined by spaces: its length in characters is the letters plus spaces. */
function words(letter: string, ...sizes: number[]): string {
  return sizes.map((size) => letter.repeat(size)).join(" ");
}

// correct = index 1 in each: never the unique longest or shortest.
const even = (id: string) => question(id, [30, 30, 30, 30], 1); // spread 2, the best possible
const slight = (id: string) => question(id, [28, 30, 32, 30], 1); // a little uneven
const rough = (id: string) => question(id, [22, 30, 40, 30], 1); // uneven but under ratio 2
const toLong = (id: string) => question(id, [20, 30, 50, 30], 1); // ratio 2.5: dropped
const tellLongest = (id: string) => question(id, [30, 30, 30, 31], 3); // spread just above 2, correct unique longest
const tellShortest = (id: string) => question(id, [29, 30, 30, 30], 0); // correct unique shortest

const ids = (questions: QuizQuestion[] | null) => questions?.map((q) => q.question);

describe("selectBalanced", () => {
  it("picks the subset with the lowest total spread", () => {
    const pool = [rough("a"), slight("b"), even("c"), rough("d"), even("e"), slight("f")];
    expect(ids(selectBalanced(pool, limits))).toEqual(["b", "c", "e"].sort());
  });

  it("keeps the original order of the chosen questions", () => {
    const pool = [even("1"), rough("2"), even("3"), rough("4"), even("5")];
    expect(ids(selectBalanced(pool, limits))).toEqual(["1", "3", "5"]);
  });

  it("ignores candidates that fail the ratio rule", () => {
    const pool = [toLong("x"), even("a"), even("b"), even("c")];
    expect(ids(selectBalanced(pool, limits))).toEqual(["a", "b", "c"]);
  });

  it("never keeps a ratio-failing candidate, even when its spread would beat every passing one", () => {
    // Passing but rough on both measures: 60 / 30 chars (ratio exactly 2) and 4 / 2 words, spread 4.
    const roughOnBoth = (id: string): QuizQuestion => ({
      question: id,
      options: [words("a", 15, 14), words("b", 15, 15, 15, 12), words("c", 15, 14, 14), words("d", 15, 14, 14)],
      correctIndex: 2,
    });
    // Just over the ratio limit (62 / 30) but one word each, spread about 3.07: cheaper than roughOnBoth.
    const justOver = (id: string) => question(id, [30, 62, 40, 40], 2);

    expect(lengthSpread(justOver("x"))).toBeLessThan(lengthSpread(roughOnBoth("a")));
    const pool = [justOver("x"), justOver("y"), roughOnBoth("a"), roughOnBoth("b"), roughOnBoth("c")];
    expect(ids(selectBalanced(pool, limits))).toEqual(["a", "b", "c"]);
  });

  it("returns null when fewer than questionCount candidates pass the ratio rule", () => {
    expect(selectBalanced([toLong("x"), toLong("y"), even("a"), even("b")], limits)).toBeNull();
    expect(selectBalanced([even("a"), even("b")], limits)).toBeNull();
    expect(selectBalanced([], limits)).toBeNull();
  });

  it("respects the tell limit: the cheapest subset breaks it, so a different subset is chosen", () => {
    // Cheapest by spread is the three tell questions (each barely uneven), but only one unique-longest is allowed.
    const pool = [tellLongest("t1"), tellLongest("t2"), tellLongest("t3"), rough("r1"), rough("r2")];
    const chosen = selectBalanced(pool, limits);

    expect(chosen).not.toBeNull();
    expect(ids(chosen)).not.toEqual(["t1", "t2", "t3"]);
    expect(chosen!.filter((q) => q.question.startsWith("t"))).toHaveLength(1);
    expect(checkBalance(chosen!, limits).ok).toBe(true);
  });

  it("applies the tell limit to unique-shortest separately", () => {
    const pool = [tellShortest("s1"), tellShortest("s2"), tellLongest("t1"), tellLongest("t2"), rough("r1")];
    const chosen = selectBalanced(pool, limits);

    expect(chosen).not.toBeNull();
    expect(chosen!.filter((q) => q.question.startsWith("s"))).toHaveLength(1);
    expect(chosen!.filter((q) => q.question.startsWith("t"))).toHaveLength(1);
  });

  it("returns null when every subset breaks the tell limits", () => {
    const pool = [tellLongest("a"), tellLongest("b"), tellLongest("c"), tellLongest("d")];
    expect(selectBalanced(pool, limits)).toBeNull();
  });

  it("does not count ties as tells", () => {
    const tiedLongest = (id: string) => question(id, [30, 30, 32, 32], 2);
    const pool = [tiedLongest("a"), tiedLongest("b"), tiedLongest("c"), tiedLongest("d")];
    expect(ids(selectBalanced(pool, limits))).toEqual(["a", "b", "c"]);
  });

  it("prefers the earlier (better) candidates when spreads tie", () => {
    const pool = [even("a"), even("b"), even("c"), even("d"), even("e")];
    expect(ids(selectBalanced(pool, limits))).toEqual(["a", "b", "c"]);
  });

  it("does not modify its input", () => {
    const pool = [rough("a"), toLong("b"), even("c"), tellLongest("d"), even("e")];
    const snapshot = JSON.stringify(pool);
    const order = pool.map((q) => q.question);

    selectBalanced(pool, limits);

    expect(JSON.stringify(pool)).toBe(snapshot);
    expect(pool.map((q) => q.question)).toEqual(order);
  });
});
