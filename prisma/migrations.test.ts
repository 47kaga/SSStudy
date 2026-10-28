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
