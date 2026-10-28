import { describe, expect, it } from "vitest";
import {
  averageLengthRatio,
  checkBalance,
  describeRejections,
  lengthSpread,
  longestOptionGuessScore,
  questionRatioProblem,
  summarizeRejections,
} from "./balance";
import type { QuizQuestion } from "./types";

// Fixed here, not read from data/quiz.ts, so these tests describe the rules and not today's config.
// The gaps are 0 here so the ratio rule is tested on its own; the gap rule has its own tests below.
const limits = {
  maxOptionLengthRatio: 1.5,
  maxOptionCharGap: 0,
  maxOptionWordGap: 0,
  shortOptionExemptChars: 20,
  maxLengthTellQuestions: 2,
};

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

// ---- the gap rule and the rejection summary ----

const gapLimits = {
  maxOptionLengthRatio: 2,
  maxOptionCharGap: 30,
  maxOptionWordGap: 3,
  shortOptionExemptChars: 20,
  maxLengthTellQuestions: 1,
};

/** One option of exactly `chars` characters made of `wordCount` words of one repeated letter. */
function phrase(wordCount: number, chars: number, letter: string): string {
  const letters = chars - (wordCount - 1);
  const sizes = Array.from({ length: wordCount }, (_, i) => Math.floor(letters / wordCount) + (i < letters % wordCount ? 1 : 0));
  return sizes.map((size) => letter.repeat(size)).join(" ");
}

/** Four options of the same character length whose word counts are the given ones. */
function byWords(wordCounts: number[], chars = 40): QuizQuestion {
  return {
    question: "Q?",
    options: wordCounts.map((count, index) => phrase(count, chars, String.fromCharCode(97 + index))),
    correctIndex: 1,
  };
}

describe("questionRatioProblem: the absolute gap rule", () => {
  it("passes a question over the ratio when the characters differ by at most the gap", () => {
    // 22 vs 52: ratio 2.36 (over 2.0) but a gap of exactly 30.
    expect(questionRatioProblem(byLength([22, 25, 28, 52], 1), gapLimits)).toBeNull();
  });

  it("fails a question over the ratio when the gap is above the limit", () => {
    // 22 vs 53: ratio 2.4 and a gap of 31.
    expect(questionRatioProblem(byLength([22, 25, 28, 53], 1), gapLimits)).toBe("characters");
  });

  it("still passes a question within the ratio however large the gap", () => {
    expect(questionRatioProblem(byLength([100, 120, 150, 200], 1), gapLimits)).toBeNull();
  });

  it("passes a words difference of exactly the word gap and fails one word more", () => {
    // Same character length everywhere, words 1 / 2 / 3 / 4 (ratio 4, gap 3) and 1 / 2 / 3 / 5 (gap 4).
    expect(questionRatioProblem(byWords([1, 2, 3, 4]), gapLimits)).toBeNull();
    expect(questionRatioProblem(byWords([1, 2, 3, 5]), gapLimits)).toBe("words");
  });

  it("checks the characters measure first when both fail", () => {
    const both: QuizQuestion = {
      question: "Q?",
      options: [phrase(1, 22, "a"), phrase(5, 25, "b"), phrase(2, 28, "c"), phrase(3, 60, "d")],
      correctIndex: 0,
    };
    expect(questionRatioProblem(both, gapLimits)).toBe("characters");
  });

  it("uses the gaps it is given", () => {
    const strict = { ...gapLimits, maxOptionCharGap: 29 };
    expect(questionRatioProblem(byLength([22, 25, 28, 52], 1), strict)).toBe("characters");
  });

  it("leaves the tell rules unchanged: a gap-tolerated question can still be a tell", () => {
    const tell = byLength([22, 25, 28, 52], 3); // correct is the unique longest
    expect(checkBalance([tell], gapLimits).ok).toBe(true);
    const result = checkBalance([tell, tell], gapLimits);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/unique longest/);
    const shortTell = byLength([22, 40, 45, 50], 0); // correct is the unique shortest
    expect(checkBalance([shortTell, shortTell], gapLimits).ok).toBe(false);
  });
});

describe("summarizeRejections", () => {
  const charsFail = () => byLength([22, 25, 28, 53], 1);
  const wordsFail = () => byWords([1, 2, 3, 5]);
  const bothFail = (): QuizQuestion => ({
    question: "Q?",
    options: [phrase(1, 22, "a"), phrase(5, 25, "b"), phrase(2, 28, "c"), phrase(3, 60, "d")],
    correctIndex: 0,
  });
  const fine = () => byLength([26, 28, 30, 32], 1);

  it("counts failures by measure and usable candidates", () => {
    const counts = summarizeRejections([charsFail(), charsFail(), wordsFail(), fine(), fine(), fine()], gapLimits);
    expect(counts).toEqual({ total: 6, failedCharacters: 2, failedWords: 1, usable: 3 });
  });

  it("counts a candidate that fails both measures once, under characters", () => {
    expect(summarizeRejections([bothFail(), bothFail(), fine()], gapLimits)).toEqual({
      total: 3,
      failedCharacters: 2,
      failedWords: 0,
      usable: 1,
    });
  });

  it("counts exempt short-answer candidates as usable", () => {
    const short: QuizQuestion = { question: "Q?", options: ["Mutex", "Semaphore", "Monitor", "Spinlock"], correctIndex: 0 };
    expect(summarizeRejections([short], gapLimits).usable).toBe(1);
  });

  it("returns all zeros for an empty list", () => {
    expect(summarizeRejections([], gapLimits)).toEqual({ total: 0, failedCharacters: 0, failedWords: 0, usable: 0 });
  });

  it("always adds up to the total", () => {
    const counts = summarizeRejections([charsFail(), wordsFail(), bothFail(), fine()], gapLimits);
    expect(counts.failedCharacters + counts.failedWords + counts.usable).toBe(counts.total);
  });

  it("does not modify its input", () => {
    const pool = [charsFail(), fine()];
    const snapshot = JSON.stringify(pool);
    summarizeRejections(pool, gapLimits);
    expect(JSON.stringify(pool)).toBe(snapshot);
  });
});

describe("describeRejections", () => {
  it("formats numbers only", () => {
    expect(describeRejections({ total: 8, failedCharacters: 3, failedWords: 2, usable: 3 })).toBe(
      "8 candidates: 3 failed on characters, 2 on words, 3 usable",
    );
  });
});