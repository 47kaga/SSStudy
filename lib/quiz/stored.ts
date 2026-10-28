// Reads quiz questions back from the database. No React, Next, Prisma, SDK or server-only imports.
import { finalQuizLimits, validateModelOutput, type ValidationLimits } from "./validate";
import type { QuizQuestion } from "./types";

/** Returns the questions, or null if the stored JSON is corrupt. Uses the same checks as model output. */
export function parseStoredQuestions(json: string, limits: ValidationLimits = finalQuizLimits): QuizQuestion[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  const result = validateModelOutput({ status: "ok", questions: parsed }, limits);
  return result.kind === "quiz" ? result.questions : null;
}
