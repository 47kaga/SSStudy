import { describe, expect, it } from "vitest";
import { quiz } from "@/data/quiz";
import { normalizeSource } from "./source";

// A varied passage well over the character and distinct-word minimums.
const passage =
  "Photosynthesis is the process by which green plants, algae and some bacteria convert light energy into chemical " +
  "energy. Inside the chloroplast, chlorophyll absorbs sunlight and drives reactions that split water molecules, " +
  "releasing oxygen as a by-product. The energy captured is then used to assemble glucose from carbon dioxide in a " +
  "cycle of reactions that does not need light directly. Plants store this glucose as starch, use it to build " +
  "cellulose for their cell walls, and burn it during respiration to power growth and repair.";

describe("normalizeSource", () => {
  it("accepts a valid passage", () => {
    expect(passage.length).toBeGreaterThanOrEqual(quiz.minSourceChars);
    expect(normalizeSource(passage)).toEqual({ ok: true, text: passage });
  });

  it("trims whitespace padding and counts length after trimming", () => {
    expect(normalizeSource(`  \n${passage}\t \n`)).toEqual({ ok: true, text: passage });

    const padded = `${" ".repeat(quiz.minSourceChars)}short${" ".repeat(quiz.minSourceChars)}`;
    expect(normalizeSource(padded).ok).toBe(false);
  });

  it("rejects text that is too short", () => {
    const result = normalizeSource("Too short.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(String(quiz.minSourceChars));
  });

  it("rejects text that is too long", () => {
    const result = normalizeSource(`${passage} `.repeat(Math.ceil(quiz.maxSourceChars / passage.length) + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(String(quiz.maxSourceChars));
  });

  it("accepts text exactly at the maximum length", () => {
    const base = `${passage} `.repeat(Math.ceil(quiz.maxSourceChars / passage.length) + 1);
    expect(normalizeSource(base.slice(0, quiz.maxSourceChars)).ok).toBe(true);
  });

  it("rejects non-string input", () => {
    for (const input of [undefined, null, 42, {}, [], ["a"]]) {
      expect(normalizeSource(input).ok).toBe(false);
    }
  });

  it("rejects one sentence repeated many times", () => {
    const result = normalizeSource("The cell is the basic unit of life. ".repeat(100));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("different words");
  });

  it("counts distinct words case-insensitively", () => {
    expect(normalizeSource("Alpha alpha ALPHA beta Beta ".repeat(40)).ok).toBe(false);
  });

  it("uses custom limits when given", () => {
    const limits = { minSourceChars: 5, maxSourceChars: 20, minDistinctWords: 2 };
    expect(normalizeSource("one two", limits).ok).toBe(true);
    expect(normalizeSource("one one one one", limits).ok).toBe(false); // one distinct word
    expect(normalizeSource("abcdefghijklm nopqrstuv", limits).ok).toBe(false); // 23 chars
    expect(normalizeSource("one", limits).ok).toBe(false); // 3 chars
  });
});
