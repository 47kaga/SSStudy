import { describe, expect, it } from "vitest";
import { averageLengthRatio, checkBalance, lengthSpread, longestOptionGuessScore, questionRatioProblem } from "./balance";
import type { QuizQuestion } from "./types";

// Fixed here, not read from data/quiz.ts, so these tests describe the rules and not today's config.
const limits = { maxOptionLengthRatio: 1.5, shortOptionExemptChars: 20, maxLengthTellQuestions: 2 };

/** One-word options of exact character lengths ("a" x 26, "b" x 28, ...). Word counts are all 1. */
function byLength(lengths: number[], correctIndex: number): QuizQuestion {
  return {
    question: "Q?",
    options: lengths.map((length, index) => String.fromCharCode(97 + index).repeat(length)),
    correctIndex,
  };
}

// Within the ratio, longest 32 vs shortest 26.
const MIDDLE = [26, 28, 30, 32];
const mid = () => byLength(MIDDLE, 1); // correct is neither the longest nor the shortest
const longest = () => byLength(MIDDLE, 3); // correct is the unique longest
const shortest = () => byLength(MIDDLE, 0); // correct is the unique shortest

function quizOf(...questions: QuizQuestion[]): QuizQuestion[] {
  return questions;
}

describe("checkBalance: ratio rule", () => {
  it("passes a balanced quiz", () => {
    expect(checkBalance([mid(), mid(), longest(), shortest(), mid()], limits)).toEqual({ ok: true });
  });

  it("fails a question with a 2x gap in characters, and names the question", () => {
    const result = checkBalance([mid(), mid(), byLength([20, 28, 40, 30], 1), mid(), mid()], limits);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Question 3.*characters/);
  });

  it("fails a question whose word counts differ by more than the ratio, even if characters are close", () => {
    // 23 chars / 12 words against 25 chars / 2 words.
    const wordy = ["a b c d e f g h i j k l", "abcdefghijk lmnopqrstuvwx", "abcdefghijkl mnopqrstuvw", "abcdefghijklm nopqrstuvw"];
    const result = checkBalance([mid(), { question: "Q?", options: wordy, correctIndex: 1 }, mid(), mid(), mid()], limits);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Question 2.*words/);
  });

  it("allows a ratio of exactly the limit and fails just above it", () => {
    expect(checkBalance([byLength([20, 30, 30, 30], 1)], limits).ok).toBe(true);
    expect(checkBalance([byLength([20, 31, 30, 30], 1)], limits).ok).toBe(false);
  });

  it("skips the ratio check when the longest option is short (numeric answers)", () => {
    const numbers: QuizQuestion = { question: "How many?", options: ["3", "12", "144", "1,024"], correctIndex: 2 };
    expect(checkBalance([numbers, numbers, numbers], limits).ok).toBe(true);
  });

  it("applies the exemption only up to the limit", () => {
    const limit = limits.shortOptionExemptChars;
    expect(checkBalance([byLength([1, limit, 2, 3], 2)], limits).ok).toBe(true);
    expect(checkBalance([byLength([1, limit + 1, 2, 3], 2)], limits).ok).toBe(false);
  });
});

describe("checkBalance: length tells", () => {
  it("fails when the correct answer is the unique longest in 3 of 5 questions", () => {
    const result = checkBalance(quizOf(longest(), longest(), longest(), mid(), mid()), limits);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/longest/);
  });

  it("passes when the correct answer is the unique longest in 2 of 5 questions", () => {
    expect(checkBalance(quizOf(longest(), longest(), mid(), mid(), mid()), limits).ok).toBe(true);
  });

  it("fails when the correct answer is the unique shortest in 3 of 5 questions", () => {
    const result = checkBalance(quizOf(shortest(), shortest(), shortest(), mid(), mid()), limits);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/shortest/);
  });

  it("passes when the correct answer is the unique shortest in 2 of 5 questions", () => {
    expect(checkBalance(quizOf(shortest(), shortest(), mid(), mid(), mid()), limits).ok).toBe(true);
  });

  it("counts longest and shortest tells separately", () => {
    expect(checkBalance(quizOf(longest(), longest(), shortest(), shortest(), mid()), limits).ok).toBe(true);
  });

  it("does not count a tie for longest or shortest as a tell", () => {
    const tiedLongest = byLength([26, 28, 32, 32], 2);
    const tiedShortest = byLength([26, 26, 30, 32], 0);
    expect(checkBalance(quizOf(tiedLongest, tiedLongest, tiedLongest, tiedLongest, tiedLongest), limits).ok).toBe(true);
    expect(checkBalance(quizOf(tiedShortest, tiedShortest, tiedShortest, tiedShortest, tiedShortest), limits).ok).toBe(true);
  });

  it("uses the limits it is given", () => {
    const strict = { ...limits, maxLengthTellQuestions: 0 };
    expect(checkBalance(quizOf(longest(), mid(), mid(), mid(), mid()), strict).ok).toBe(false);
  });
});

describe("longestOptionGuessScore", () => {
  it("counts questions where the correct answer is the unique longest", () => {
    expect(longestOptionGuessScore(quizOf(longest(), longest(), mid(), shortest(), mid()))).toBe(2);
  });

  it("scores 0 and full marks at the extremes", () => {
    expect(longestOptionGuessScore(quizOf(mid(), shortest()))).toBe(0);
    expect(longestOptionGuessScore(quizOf(longest(), longest(), longest()))).toBe(3);
  });

  it("counts a tie for longest as wrong, even when the correct answer is one of the tied options", () => {
    expect(longestOptionGuessScore(quizOf(byLength([26, 28, 32, 32], 2), byLength([26, 28, 32, 32], 3)))).toBe(0);
  });

  it("returns 0 for an empty quiz", () => {
    expect(longestOptionGuessScore([])).toBe(0);
  });
});

describe("questionRatioProblem", () => {
  it("is null for an even question and names the failing measure otherwise", () => {
    expect(questionRatioProblem(byLength(MIDDLE, 1), limits)).toBeNull();
    expect(questionRatioProblem(byLength([20, 28, 40, 30], 1), limits)).toBe("characters");
    const wordy = ["a b c d e f g h i j k l", "abcdefghijk lmnopqrstuvwx", "abcdefghijkl mnopqrstuvw", "abcdefghijklm nopqrstuvw"];
    expect(questionRatioProblem({ question: "Q?", options: wordy, correctIndex: 1 }, limits)).toBe("words");
  });
});

describe("lengthSpread", () => {
  it("is 2 for perfectly even options and grows with the gap", () => {
    expect(lengthSpread(byLength([30, 30, 30, 30], 0))).toBe(2);
    expect(lengthSpread(byLength([20, 30, 30, 40], 0))).toBeGreaterThan(lengthSpread(byLength([28, 30, 30, 32], 0)));
  });

  it("adds the word-count ratio to the character ratio", () => {
    const question: QuizQuestion = { question: "Q?", options: ["aa bb", "cc", "dd ee", "ff gg"], correctIndex: 0 };
    // characters 5 / 2 = 2.5, words 2 / 1 = 2
    expect(lengthSpread(question)).toBe(4.5);
  });
});

describe("averageLengthRatio", () => {
  it("averages the longest-to-shortest character ratio over the questions", () => {
    // ratios 2 and 1
    expect(averageLengthRatio([byLength([10, 20, 15, 12], 0), byLength([30, 30, 30, 30], 0)])).toBe(1.5);
  });

  it("is 1 when every option has the same length", () => {
    expect(averageLengthRatio([byLength([30, 30, 30, 30], 0)])).toBe(1);
  });

  it("returns 0 for an empty quiz and ignores the answer key", () => {
    expect(averageLengthRatio([])).toBe(0);
    expect(averageLengthRatio([{ options: ["aa", "aaaa"] }])).toBe(2);
  });
});
