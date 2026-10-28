import "server-only";
import { db } from "@/lib/db";
import { calculateAward, sessionEligibility, type TimeLimit } from "@/lib/economy";
import { toPublicQuiz } from "./public";
import { parseStoredQuestions } from "./stored";
import type { PublicQuestion } from "./types";

/** What the quiz page for one study session shows. Built only from stored rows, never from the request. */
export type QuizPageState =
  | { kind: "not-found" }
  | { kind: "running" }
  | { kind: "too-short" }
  | { kind: "unavailable" }
  | { kind: "paste"; durationSeconds: number }
  /** Stored and not graded: only the questions and options, never the answer key. */
  | { kind: "quiz"; quizId: number; questions: PublicQuestion[] }
  | {
      kind: "graded";
      durationSeconds: number;
      countedSeconds: number;
      limitedBy: TimeLimit;
      correctAnswers: number;
      totalQuestions: number;
      rawShards: number;
      awarded: number;
      cappedByDaily: boolean;
    };

export async function getQuizPageState(sessionId: number): Promise<QuizPageState> {
  const session = await db.studySession.findUnique({ where: { id: sessionId } });
  if (!session) return { kind: "not-found" };
  if (session.endedAt === null || session.durationSeconds === null) return { kind: "running" };

  const stored = await db.quiz.findUnique({ where: { sessionId } });
  if (!stored) {
    if (!sessionEligibility(session.durationSeconds).eligible) return { kind: "too-short" };
    return { kind: "paste", durationSeconds: session.durationSeconds };
  }

  if (stored.gradedAt && stored.correctAnswers !== null) {
    const paid = await db.shardLedger.findUnique({ where: { sessionId } });
    const awarded = paid?.amount ?? 0;
    // The daily-cap figures at grading time are not stored, so recompute only what depends on stored data.
    const award = calculateAward({
      durationSeconds: session.durationSeconds,
      sourceChars: stored.sourceChars,
      correctAnswers: stored.correctAnswers,
      totalQuestions: stored.totalQuestions,
      earnedInWindow: 0,
    });
    return {
      kind: "graded",
      durationSeconds: session.durationSeconds,
      countedSeconds: award.countedSeconds,
      limitedBy: award.limitedBy,
      correctAnswers: stored.correctAnswers,
      totalQuestions: stored.totalQuestions,
      rawShards: award.rawShards,
      awarded,
      cappedByDaily: awarded < award.rawShards,
    };
  }

  const questions = parseStoredQuestions(stored.questionsJson);
  if (!questions) {
    console.error(`[quiz] Stored quiz ${stored.id} could not be parsed.`);
    return { kind: "unavailable" };
  }
  return { kind: "quiz", quizId: stored.id, questions: toPublicQuiz(questions) };
}
