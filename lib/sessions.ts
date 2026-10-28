import "server-only";
import { db } from "@/lib/db";
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
  if (!project) return { ok: false, reason: "no-such-project" };
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

// Harmless no-op when nothing is running. Duration is computed from the server clock.
export async function stopRunningSession(): Promise<void> {
  const running = await db.studySession.findFirst({ where: { endedAt: null } });
  if (!running) return;

  const endedAt = new Date();
  await db.studySession.updateMany({
    where: { id: running.id, endedAt: null },
    data: { endedAt, durationSeconds: elapsedSeconds(running.startedAt, endedAt) },
  });
}

export async function listRecentSessions(): Promise<RecentSession[]> {
  const sessions = await db.studySession.findMany({
    where: { endedAt: { not: null } },
    include: { project: true },
    orderBy: { startedAt: "desc" },
    take: RECENT_SESSION_LIMIT,
  });
  return sessions.map((session) => ({
    id: session.id,
    projectTitle: session.project.title,
    startedAtMs: session.startedAt.getTime(),
    durationSeconds: session.durationSeconds ?? 0,
  }));
}
