import { describe, expect, it } from "vitest";
import type { QuizQuestion } from "./types";
import { shuffleOptions } from "./shuffle";

const sample: QuizQuestion = {
  question: "Which organelle carries out photosynthesis?",
  options: ["Mitochondrion", "Chloroplast", "Ribosome", "Nucleus"],
  correctIndex: 1,
};

/** Small deterministic PRNG (mulberry32) so seeded runs are reproducible. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random() that replays the choices Fisher-Yates makes for 4 options (3, 2 and 1 choices). */
function scripted(choices: number[], sizes: number[]): () => number {
  let call = 0;
  return () => {
    const value = (choices[call] + 0.5) / sizes[call];
    call += 1;
    return value;
  };
}

describe("shuffleOptions", () => {
  it("keeps the same multiset of options", () => {
    const result = shuffleOptions(sample, seeded(1));
    expect([...result.options].sort()).toEqual([...sample.options].sort());
  });

  it("keeps the correct option text for many seeded shuffles", () => {
    for (let seed = 0; seed < 500; seed += 1) {
      const result = shuffleOptions(sample, seeded(seed));
      expect(result.options[result.correctIndex]).toBe(sample.options[sample.correctIndex]);
    }
  });

  it("keeps the correct option text for every one of the 24 permutations", () => {
    const seen = new Set<string>();
    // Fisher-Yates over 4 options makes 3 draws, with 4, 3 and 2 possible values.
    for (let a = 0; a < 4; a += 1) {
      for (let b = 0; b < 3; b += 1) {
        for (let c = 0; c < 2; c += 1) {
          const result = shuffleOptions(sample, scripted([a, b, c], [4, 3, 2]));
          expect(result.options[result.correctIndex]).toBe("Chloroplast");
          seen.add(result.options.join("|"));
        }
      }
    }
    expect(seen.size).toBe(24);
  });

  it("does not mutate the input", () => {
    const input: QuizQuestion = { ...sample, options: [...sample.options] };
    const snapshot = JSON.stringify(input);
    const result = shuffleOptions(input, seeded(7));
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(result).not.toBe(input);
    expect(result.options).not.toBe(input.options);
  });

  it("is reproducible with a deterministic random", () => {
    expect(shuffleOptions(sample, seeded(42))).toEqual(shuffleOptions(sample, seeded(42)));
  });

  it("puts the correct answer in every position across many seeded shuffles", () => {
    const positions = new Set<number>();
    for (let seed = 0; seed < 200; seed += 1) positions.add(shuffleOptions(sample, seeded(seed)).correctIndex);
    expect([...positions].sort()).toEqual([0, 1, 2, 3]);
  });

  it("is roughly uniform across positions", () => {
    const counts = [0, 0, 0, 0];
    const runs = 4000;
    const random = seeded(2026);
    for (let i = 0; i < runs; i += 1) counts[shuffleOptions(sample, random).correctIndex] += 1;
    for (const count of counts) expect(Math.abs(count - runs / 4)).toBeLessThan(runs * 0.05);
  });

  it("only returns the known fields", () => {
    const withExtra = { ...sample, explanation: "junk" } as QuizQuestion;
    expect(Object.keys(shuffleOptions(withExtra, seeded(3))).sort()).toEqual(["correctIndex", "options", "question"]);
  });

  it("tolerates a random() that returns exactly 1", () => {
    const result = shuffleOptions(sample, () => 1);
    expect(result.options[result.correctIndex]).toBe("Chloroplast");
  });
});
