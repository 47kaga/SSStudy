// Picks the most length-balanced questions from a candidate pool.
// No React, Next, Prisma, SDK or server-only imports.
import { checkBalance, lengthSpread, questionRatioProblem, type BalanceLimits } from "./balance";
import type { QuizQuestion } from "./types";

export type SelectLimits = BalanceLimits & { questionCount: number };

/** Every way to pick `size` items from `items`, keeping their order. */
function* subsets<T>(items: T[], size: number, start = 0, chosen: T[] = []): Generator<T[]> {
  if (chosen.length === size) {
    yield chosen;
    return;
  }
  for (let index = start; index <= items.length - (size - chosen.length); index += 1) {
    yield* subsets(items, size, index + 1, [...chosen, items[index]]);
  }
}

/**
 * 1. Drops candidates that fail the per-question ratio rule.
 * 2. Of the rest, chooses the `questionCount` questions that pass the tell limits and have the smallest
 *    total spread (the earliest subset wins a tie, and candidates are ordered best first).
 * 3. Keeps the original order. Returns null when no subset qualifies. Does not modify `candidates`.
 */
export function selectBalanced(candidates: QuizQuestion[], limits: SelectLimits): QuizQuestion[] | null {
  const usable = candidates.filter((question) => questionRatioProblem(question, limits) === null);
  if (usable.length < limits.questionCount) return null;

  // The ratio rule was applied per question above, so here checkBalance only enforces the tell limits.
  const tellLimits = { ...limits, maxOptionLengthRatio: Infinity };

  let best: QuizQuestion[] | null = null;
  let bestSpread = Infinity;
  for (const subset of subsets(usable, limits.questionCount)) {
    if (!checkBalance(subset, tellLimits).ok) continue;
    const spread = subset.reduce((sum, question) => sum + lengthSpread(question), 0);
    if (spread < bestSpread) {
      best = subset;
      bestSpread = spread;
    }
  }
  return best;
}
