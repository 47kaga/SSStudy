import "server-only";
import { db } from "@/lib/db";
import { gradeQuiz } from "./grade";
import { parseStoredQuestions } from "./stored";
import type { GradeResult } from "./types";

export type GradeOutcome =
  | ({ ok: true } & GradeResult)
  | { ok: false; code: "not-found" | "already-graded" | "invalid-answers" | "corrupt"; message: string };

/**
 * Grades a stored quiz once. Answers are checked before the quiz is claimed, so a malformed
 * request does not use up the single grading attempt. The claim itself is one conditional update
 * (gradedAt IS NULL), so two concurrent requests cannot both be graded.
 */
export async function gradeStoredQuiz(quizId: number, answers: number[]): Promise<GradeOutcome> {
  const stored = await db.quiz.findUnique({ where: { id: quizId } });
  if (!stored) return { ok: false, code: "not-found", message: "Quiz not found." };
  if (stored.gradedAt) return { ok: false, code: "already-graded", message: "This quiz was already graded." };

  const questions = parseStoredQuestions(stored.questionsJson);
  if (!questions) {
    console.error(`[quiz] Stored quiz ${quizId} could not be parsed.`);
    return { ok: false, code: "corrupt", message: "This quiz is unavailable." };
  }

  let grade: GradeResult;
  try {
    grade = gradeQuiz(questions, answers);
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, code: "invalid-answers", message: error.message };
    throw error;
  }

  const claimed = await db.quiz.updateMany({
    where: { id: quizId, gradedAt: null },
    data: { gradedAt: new Date(), correctAnswers: grade.correctAnswers },
  });
  if (claimed.count === 0) return { ok: false, code: "already-graded", message: "This quiz was already graded." };

  return { ok: true, ...grade };
}
