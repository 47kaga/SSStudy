import "server-only";
import { economy } from "@/data/economy";
import { db } from "@/lib/db";
import { calculateAward, sessionEligibility, type AwardBreakdown } from "@/lib/economy";
import { sumLedger } from "@/lib/shards";
import type { Prisma } from "@/generated/prisma/client";

// Everything here reads stored data. Nothing takes a duration, a score or an amount from a request.

export type SessionUnlock =
  | { ok: true; durationSeconds: number }
  | { ok: false; code: "session-not-found" | "too-short" | "already-has-quiz" };

/**
 * Whether a session may get a quiz: it must exist and have ended, be long enough, and not have a quiz yet.
 * A quiz that failed to generate stores nothing, so it does not use up the session's one quiz.
 */
export async function checkSessionUnlock(sessionId: number): Promise<SessionUnlock> {
  const session = await db.studySession.findUnique({ where: { id: sessionId } });
  if (!session || session.endedAt === null || session.durationSeconds === null) {
    return { ok: false, code: "session-not-found" };
  }
  if (!sessionEligibility(session.durationSeconds).eligible) return { ok: false, code: "too-short" };

  const existing = await db.quiz.findUnique({ where: { sessionId } });
  if (existing) return { ok: false, code: "already-has-quiz" };
  return { ok: true, durationSeconds: session.durationSeconds };
}

/** Shards paid for study sessions inside the rolling window. Lab grants, pulls and dev grants never count. */
export async function sumEarnedInWindow(client: Prisma.TransactionClient, nowMs: number): Promise<number> {
  const since = new Date(nowMs - economy.dailyWindowSeconds * 1000);
  const total = await client.shardLedger.aggregate({
    _sum: { amount: true },
    where: { sessionId: { not: null }, createdAt: { gte: since } },
  });
  return total._sum.amount ?? 0;
}

export type PaidAward = { award: AwardBreakdown; balance: number };

/**
 * Pays for a quiz that has just been claimed, inside the grading transaction. The duration comes from the
 * stored session and the material size from the stored quiz. Throws on anything unexpected, which rolls the
 * whole transaction back, so a failure never leaves a quiz claimed but unpaid.
 */
export async function awardSessionQuiz(
  tx: Prisma.TransactionClient,
  quiz: { id: number; sessionId: number; sourceChars: number },
  score: { correctAnswers: number; totalQuestions: number },
): Promise<PaidAward> {
  const session = await tx.studySession.findUnique({ where: { id: quiz.sessionId } });
  if (!session || session.durationSeconds === null) {
    throw new Error(`Quiz ${quiz.id} points at session ${quiz.sessionId}, which is missing or not finished.`);
  }
  if (!sessionEligibility(session.durationSeconds).eligible) {
    throw new Error(`Quiz ${quiz.id} belongs to session ${quiz.sessionId}, which is too short to earn anything.`);
  }

  const earnedInWindow = await sumEarnedInWindow(tx, Date.now());
  const award = calculateAward({
    durationSeconds: session.durationSeconds,
    sourceChars: quiz.sourceChars,
    correctAnswers: score.correctAnswers,
    totalQuestions: score.totalQuestions,
    earnedInWindow,
  });

  if (award.awarded > 0) {
    // sessionId is unique in the ledger, so a session can never be paid twice.
    await tx.shardLedger.create({
      data: { amount: award.awarded, sessionId: quiz.sessionId, reason: `session:${quiz.sessionId}` },
    });
  }
  return { award, balance: await sumLedger(tx) };
}
