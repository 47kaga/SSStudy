// The only shape of a quiz that may leave the server before grading. No React, Next, Prisma,
// SDK or server-only imports.
import type { PublicQuestion, QuizQuestion } from "./types";

/** Copies only `question` and `options`, so the answer key can never leak by accident. */
export function toPublicQuiz(questions: readonly QuizQuestion[]): PublicQuestion[] {
  return questions.map(({ question, options }) => ({ question, options: [...options] }));
}
