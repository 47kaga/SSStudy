import "server-only";
import { devTimerMinutes } from "@/data/dev";
import { db } from "@/lib/db";
import { sessionQuizState, type SessionQuizState } from "@/lib/session-quiz-state";
import { devToolsEnabled } from "@/lib/shards";
import { elapsedSeconds } from "@/lib/time";

export type RunningSession = {
  id: number;
  projectId: number;
  projectTitle: string;
  startedAtMs: number;
  /** Server clock when this was read, so the client can correct for its own clock skew. */
  serverNowMs: number;
};

export type RecentSession = {
  id: number;
  projectTitle: string;
  startedAtMs: number;
  durationSeconds: number;
  /** What the row offers next, worked out on the server from stored data. */
  quiz: SessionQuizState;
};

export type StartResult = { ok: true } | { ok: false; reason: "already-running" | "no-such-project" };

export const RECENT_SESSION_LIMIT = 20;

export async function getRunningSession(): Promise<RunningSession | null> {
  const session = await db.studySession.findFirst({
    where: { endedAt: null },
    include: { project: true },
  });
  if (!session) return null;
  return {
    id: session.id,
    projectId: session.projectId,
    projectTitle: session.project.title,
    startedAtMs: session.startedAt.getTime(),
    serverNowMs: Date.now(),
  };
}

// The server clock is the only clock: startedAt is set here, never taken from the client.
export async function startSession(projectId: number): Promise<StartResult> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  // An archived project counts as missing, so a stale tab cannot start a timer on it.
  if (!project || project.archivedAt) return { ok: false, reason: "no-such-project" };
  if (await getRunningSession()) return { ok: false, reason: "already-running" };

  try {
    await db.studySession.create({ data: { projectId, startedAt: new Date() } });
  } catch (error) {
    // Two starts racing: the partial unique index rejects the loser.
    if (await getRunningSession()) return { ok: false, reason: "already-running" };
    throw error;
  }
  return { ok: true };
}

export type StoppedSession = { sessionId: number; durationSeconds: number };

// Harmless no-op (returns null) when nothing is running. Duration is computed from the server clock.
export async function stopRunningSession(): Promise<StoppedSession | null> {
  const running = await db.studySession.findFirst({ where: { endedAt: null } });
  if (!running) return null;

  const endedAt = new Date();
  const durationSeconds = elapsedSeconds(running.startedAt, endedAt);
  const stopped = await db.studySession.updateMany({
    where: { id: running.id, endedAt: null },
    data: { endedAt, durationSeconds },
  });
  // Two stops racing: only the one that actually ended the session reports it.
  return stopped.count === 1 ? { sessionId: running.id, durationSeconds } : null;
}

/**
 * Development only: pretends the running session started `minutes` earlier by moving its start time back,
 * so the normal Stop path measures a longer session. Accepts only the amounts in data/dev.ts, does nothing
 * when no session is running, and does nothing in production. It never touches the ledger.
 */
export async function shiftRunningSessionStart(minutes: number): Promise<boolean> {
  if (!devToolsEnabled()) return false;
  if (!(devTimerMinutes as readonly number[]).includes(minutes)) return false;

  const running = await db.studySession.findFirst({ where: { endedAt: null } });
  if (!running) return false;

  const moved = await db.studySession.updateMany({
    where: { id: running.id, endedAt: null },
    data: { startedAt: new Date(running.startedAt.getTime() - minutes * 60_000) },
  });
  return moved.count === 1;
}

export async function listRecentSessions(): Promise<RecentSession[]> {
  const sessions = await db.studySession.findMany({
    where: { endedAt: { not: null } },
    include: { project: true },
    orderBy: { startedAt: "desc" },
    take: RECENT_SESSION_LIMIT,
  });
  const ids = sessions.map((session) => session.id);
  const [quizzes, payouts] = await Promise.all([
    db.quiz.findMany({ where: { sessionId: { in: ids } }, select: { sessionId: true, gradedAt: true } }),
    db.shardLedger.findMany({ where: { sessionId: { in: ids } }, select: { sessionId: true, amount: true } }),
  ]);
  const quizBySession = new Map(quizzes.map((quiz) => [quiz.sessionId, quiz]));
  const paidBySession = new Map(payouts.map((row) => [row.sessionId, row.amount]));

  return sessions.map((session) => {
    const quiz = quizBySession.get(session.id);
    const durationSeconds = session.durationSeconds ?? 0;
    return {
      id: session.id,
      projectTitle: session.project.title,
      startedAtMs: session.startedAt.getTime(),
      durationSeconds,
      quiz: sessionQuizState({
        durationSeconds,
        hasQuiz: quiz !== undefined,
        graded: quiz?.gradedAt != null,
        shardsAwarded: paidBySession.get(session.id) ?? 0,
      }),
    };
  });
}
