import "server-only";
import { db } from "@/lib/db";
import type { AwardBreakdown } from "@/lib/economy";
import { awardSessionQuiz } from "@/lib/rewards";
import { sumLedger } from "@/lib/shards";
import { gradeQuiz } from "./grade";
import { parseStoredQuestions } from "./stored";
import type { GradeResult } from "./types";

export type GradeOutcome =
  | ({ ok: true; award: AwardBreakdown | null; balance: number } & GradeResult)
  | { ok: false; code: "not-found" | "already-graded" | "invalid-answers" | "corrupt"; message: string };

/**
 * Grades a stored quiz once and pays for it, all in one interactive transaction. Answers are checked
 * before the quiz is claimed, so a malformed request does not use up the single grading attempt. The claim
 * is one conditional update (gradedAt IS NULL), so two concurrent requests cannot both be graded. If the
 * quiz belongs to a study session, the payout is computed from stored data and appended to the ledger in
 * the same transaction: if anything throws, the claim is rolled back and nothing is paid. Quizzes without a
 * session (the lab) are graded but award nothing.
 */
export async function gradeStoredQuiz(quizId: number, answers: number[]): Promise<GradeOutcome> {
  return db.$transaction(async (tx): Promise<GradeOutcome> => {
    const stored = await tx.quiz.findUnique({ where: { id: quizId } });
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

    const claimed = await tx.quiz.updateMany({
      where: { id: quizId, gradedAt: null },
      data: { gradedAt: new Date(), correctAnswers: grade.correctAnswers },
    });
    if (claimed.count === 0) return { ok: false, code: "already-graded", message: "This quiz was already graded." };

    if (stored.sessionId === null) {
      return { ok: true, ...grade, award: null, balance: await sumLedger(tx) };
    }

    const paid = await awardSessionQuiz(
      tx,
      { id: stored.id, sessionId: stored.sessionId, sourceChars: stored.sourceChars },
      { correctAnswers: grade.correctAnswers, totalQuestions: grade.totalQuestions },
    );
    return { ok: true, ...grade, award: paid.award, balance: paid.balance };
  });
}
