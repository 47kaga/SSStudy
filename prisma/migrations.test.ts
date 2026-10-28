import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Guards the one-running-timer rule. It lives only in migration SQL (a partial unique index that
// Prisma's schema cannot express), so a migration that rebuilds StudySession could silently drop it.

const migrationsDir = fileURLToPath(new URL("./migrations/", import.meta.url));

const MISSING_INDEX =
  "the one-running-timer index is missing or ineffective; a migration probably dropped `StudySession_one_running`. " +
  "Re-create it in a new migration (and read generated migration SQL before applying it).";

function applyAllMigrations(db: Database.Database) {
  const folders = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const folder of folders) {
    db.exec(readFileSync(join(migrationsDir, folder, "migration.sql"), "utf8"));
  }
}

function insertSession(db: Database.Database, endedAt: string | null): { code?: string } | null {
  const durationSeconds = endedAt === null ? null : 60;
  try {
    db.prepare(
      'INSERT INTO "StudySession" ("projectId", "startedAt", "endedAt", "durationSeconds") VALUES (?, ?, ?, ?)',
    ).run(1, "2026-01-01T10:00:00.000Z", endedAt, durationSeconds);
    return null;
  } catch (error) {
    return error as { code?: string };
  }
}

describe("migrations", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    applyAllMigrations(db);
    db.prepare('INSERT INTO "Project" ("title") VALUES (?)').run("Test project");
  });

  afterEach(() => {
    db.close();
  });

  it("rejects a second running session", () => {
    expect(insertSession(db, null), "first running session should be accepted").toBeNull();

    const error = insertSession(db, null);
    expect(error, MISSING_INDEX).not.toBeNull();
    expect(error?.code, MISSING_INDEX).toBe("SQLITE_CONSTRAINT_UNIQUE");
  });

  it("accepts a new running session once the first one has ended", () => {
    expect(insertSession(db, null)).toBeNull();
    db.prepare('UPDATE "StudySession" SET "endedAt" = ?, "durationSeconds" = ? WHERE "endedAt" IS NULL').run(
      "2026-01-01T11:00:00.000Z",
      3600,
    );

    expect(insertSession(db, null), "a new running session must be allowed after the previous one ended").toBeNull();
  });

  it("accepts any number of finished sessions", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(insertSession(db, "2026-01-01T11:00:00.000Z"), `finished session ${i + 1} should be accepted`).toBeNull();
    }
  });
});

// One quiz per session and one payout per session are enforced by the database, not by application code.
describe("session unlock columns", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    applyAllMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  function insertQuiz(sessionId: number | null): { code?: string } | null {
    try {
      db.prepare(
        'INSERT INTO "Quiz" ("model", "questionsJson", "sourceChars", "latencyMs", "totalQuestions", "sessionId") VALUES (?, ?, ?, ?, ?, ?)',
      ).run("test-model", "[]", 100, 1, 5, sessionId);
      return null;
    } catch (error) {
      return error as { code?: string };
    }
  }

  function insertLedger(sessionId: number | null): { code?: string } | null {
    try {
      db.prepare('INSERT INTO "ShardLedger" ("amount", "reason", "sessionId") VALUES (?, ?, ?)').run(
        1,
        sessionId === null ? "dev-grant" : `session:${sessionId}`,
        sessionId,
      );
      return null;
    } catch (error) {
      return error as { code?: string };
    }
  }

  it("rejects a second quiz for the same session", () => {
    expect(insertQuiz(7)).toBeNull();
    expect(insertQuiz(7)?.code).toBe("SQLITE_CONSTRAINT_UNIQUE");
    expect(insertQuiz(8), "a different session is still allowed").toBeNull();
  });

  it("rejects a second payout for the same session", () => {
    expect(insertLedger(7)).toBeNull();
    expect(insertLedger(7)?.code).toBe("SQLITE_CONSTRAINT_UNIQUE");
    expect(insertLedger(8), "a different session is still allowed").toBeNull();
  });

  it("accepts any number of quizzes and ledger rows without a session", () => {
    for (let i = 0; i < 4; i += 1) {
      expect(insertQuiz(null), `lab quiz ${i + 1} should be accepted`).toBeNull();
      expect(insertLedger(null), `ledger row ${i + 1} without a session should be accepted`).toBeNull();
    }
  });

  it("keeps the one-running-timer index in place after the session unlock migration", () => {
    db.prepare('INSERT INTO "Project" ("title") VALUES (?)').run("Test project");
    expect(insertSession(db, null)).toBeNull();
    expect(insertSession(db, null)?.code, MISSING_INDEX).toBe("SQLITE_CONSTRAINT_UNIQUE");
  });
});
