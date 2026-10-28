// Pure option shuffling. No React, Next, Prisma, SDK or server-only imports.
import type { QuizQuestion } from "./types";

/**
 * Returns a new question with its options in shuffled order and correctIndex remapped.
 * Models tend to favour certain answer positions, so every question is shuffled after validation.
 * `random` must return a number in [0, 1); it is injected so tests can be deterministic.
 * Fisher-Yates: walk from the end, swapping each slot with a random earlier-or-same slot.
 */
export function shuffleOptions(question: QuizQuestion, random: () => number): QuizQuestion {
  const order = question.options.map((_, index) => index);

  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.min(Math.floor(random() * (i + 1)), i);
    [order[i], order[j]] = [order[j], order[i]];
  }

  return {
    question: question.question,
    options: order.map((original) => question.options[original]),
    correctIndex: order.indexOf(question.correctIndex),
  };
}
