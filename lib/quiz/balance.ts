// Pure option-length checks. No React, Next, Prisma, SDK or server-only imports, and no data imports,
// so the lab page can use the measurement functions in the browser without pulling in the prompt.
import type { QuizQuestion } from "./types";

export type BalanceLimits = {
  maxOptionLengthRatio: number;
  /** Options this close in absolute length (characters) pass even when the ratio is high. */
  maxOptionCharGap: number;
  /** The same for word counts. */
  maxOptionWordGap: number;
  shortOptionExemptChars: number;
  maxLengthTellQuestions: number;
};

export type BalanceResult = { ok: true } | { ok: false; message: string };

function wordCount(option: string): number {
  return option.trim().split(/\s+/).filter(Boolean).length;
}

/** Index of the single longest option by characters, or null when the longest is tied. */
function uniqueLongestIndex(options: string[]): number | null {
  const longest = Math.max(...options.map((option) => option.length));
  const holders = options.flatMap((option, index) => (option.length === longest ? [index] : []));
  return holders.length === 1 ? holders[0] : null;
}

/** Index of the single shortest option by characters, or null when the shortest is tied. */
function uniqueShortestIndex(options: string[]): number | null {
  const shortest = Math.min(...options.map((option) => option.length));
  const holders = options.flatMap((option, index) => (option.length === shortest ? [index] : []));
  return holders.length === 1 ? holders[0] : null;
}

/**
 * The per-question length rule: null when the question's options are close enough in length, otherwise
 * which measure failed. Skipped when the longest option is at most `shortOptionExemptChars` long. A measure
 * passes when longest / shortest is within `maxOptionLengthRatio`, or when the absolute difference is within
 * the gap limit: short terms differ a lot by ratio but little in absolute size, and the tell limits (not
 * this rule) are what stop the answer being guessed from length.
 */
export function questionRatioProblem(question: QuizQuestion, limits: BalanceLimits): "characters" | "words" | null {
  const chars = question.options.map((option) => option.length);
  const longestChars = Math.max(...chars);
  const shortestChars = Math.min(...chars);
  if (longestChars <= limits.shortOptionExemptChars) return null;

  const charsClose =
    longestChars <= limits.maxOptionLengthRatio * shortestChars || longestChars - shortestChars <= limits.maxOptionCharGap;
  if (!charsClose) return "characters";

  const words = question.options.map(wordCount);
  const longestWords = Math.max(...words);
  const shortestWords = Math.min(...words);
  const wordsClose =
    longestWords <= limits.maxOptionLengthRatio * shortestWords || longestWords - shortestWords <= limits.maxOptionWordGap;
  if (!wordsClose) return "words";
  return null;
}

export type RejectionCounts = {
  total: number;
  failedCharacters: number;
  failedWords: number;
  usable: number;
};

/**
 * Counts how many candidates fail the per-question rule and why. Each candidate is counted once, under the
 * first measure it fails (characters before words). Numbers only: no question or option text.
 */
export function summarizeRejections(candidates: QuizQuestion[], limits: BalanceLimits): RejectionCounts {
  const counts: RejectionCounts = { total: candidates.length, failedCharacters: 0, failedWords: 0, usable: 0 };
  for (const candidate of candidates) {
    const problem = questionRatioProblem(candidate, limits);
    if (problem === "characters") counts.failedCharacters += 1;
    else if (problem === "words") counts.failedWords += 1;
    else counts.usable += 1;
  }
  return counts;
}

/** For log lines, for example "8 candidates: 3 failed on characters, 2 on words, 3 usable". */
export function describeRejections(counts: RejectionCounts): string {
  return `${counts.total} candidates: ${counts.failedCharacters} failed on characters, ${counts.failedWords} on words, ${counts.usable} usable`;
}
/**
 * Fails a quiz whose answers can be guessed from option length: a question whose options differ too much
 * in length or word count, or a correct answer that is too often the unique longest or unique shortest.
 */
export function checkBalance(questions: QuizQuestion[], limits: BalanceLimits): BalanceResult {
  let uniqueLongestCorrect = 0;
  let uniqueShortestCorrect = 0;

  for (const [index, question] of questions.entries()) {
    const problem = questionRatioProblem(question, limits);
    if (problem) {
      return { ok: false, message: `Question ${index + 1} has options of very different length (by ${problem}).` };
    }

    if (uniqueLongestIndex(question.options) === question.correctIndex) uniqueLongestCorrect += 1;
    if (uniqueShortestIndex(question.options) === question.correctIndex) uniqueShortestCorrect += 1;
  }

  if (uniqueLongestCorrect > limits.maxLengthTellQuestions) {
    return {
      ok: false,
      message: `The correct answer is the unique longest option in ${uniqueLongestCorrect} questions (limit ${limits.maxLengthTellQuestions}).`,
    };
  }
  if (uniqueShortestCorrect > limits.maxLengthTellQuestions) {
    return {
      ok: false,
      message: `The correct answer is the unique shortest option in ${uniqueShortestCorrect} questions (limit ${limits.maxLengthTellQuestions}).`,
    };
  }
  return { ok: true };
}

/**
 * How uneven one question's options are: longest / shortest by characters plus the same by words.
 * 2 is perfectly even; higher is worse. Used to rank questions, not to reject them.
 */
export function lengthSpread(question: QuizQuestion): number {
  const chars = question.options.map((option) => option.length);
  const words = question.options.map(wordCount);
  return Math.max(...chars) / Math.min(...chars) + Math.max(...words) / Math.min(...words);
}

/**
 * How many questions always picking the unique longest option (by characters) would get right.
 * Ties for longest count as wrong. Used for measurement only, never to reject a quiz.
 */
export function longestOptionGuessScore(questions: QuizQuestion[]): number {
  return questions.filter((question) => uniqueLongestIndex(question.options) === question.correctIndex).length;
}

/**
 * Mean over questions of (longest option / shortest option) by characters. 1 means every question has
 * equal-length options. Returns 0 for an empty quiz. Measurement only.
 */
export function averageLengthRatio(questions: { options: string[] }[]): number {
  if (questions.length === 0) return 0;
  const total = questions.reduce((sum, question) => {
    const chars = question.options.map((option) => option.length);
    return sum + Math.max(...chars) / Math.min(...chars);
  }, 0);
  return total / questions.length;
}
