import { describe, expect, it } from "vitest";
import { economy, type EconomyConfig } from "@/data/economy";
import { calculateShards, type ShardInput } from "./economy";

const MINUTE = 60;
const HOUR = 3600;

function shards(durationSeconds: number, correctAnswers: number, totalQuestions: number, config?: EconomyConfig) {
  return calculateShards({ durationSeconds, correctAnswers, totalQuestions }, config);
}

describe("design doc examples", () => {
  it("60 minutes at 100% gives 6 shards", () => {
    expect(shards(60 * MINUTE, 10, 10)).toBe(6);
  });

  it("60 minutes at 0% gives 0 shards", () => {
    expect(shards(60 * MINUTE, 0, 10)).toBe(0);
  });
});

describe("partial scores", () => {
  it("60 minutes at 3 of 5 gives 3 (3.6 floored)", () => {
    expect(shards(60 * MINUTE, 3, 5)).toBe(3);
  });

  it("25 minutes at 2 of 3 gives 1 (1.67 floored)", () => {
    expect(shards(25 * MINUTE, 2, 3)).toBe(1);
  });
});

describe("flooring", () => {
  it("gives 0 under 10 minutes", () => {
    expect(shards(5 * MINUTE, 5, 5)).toBe(0);
  });

  it("gives 1 at exactly 10 minutes and 100%", () => {
    expect(shards(10 * MINUTE, 5, 5)).toBe(1);
  });

  it("gives 0 at 9 minutes 59 seconds and 100%", () => {
    expect(shards(9 * MINUTE + 59, 5, 5)).toBe(0);
  });

  it("always returns a whole number", () => {
    expect(Number.isInteger(shards(1234, 7, 9))).toBe(true);
  });
});

describe("session cap", () => {
  const cap = economy.maxCountedSecondsPerSession;

  it("a 5-hour session equals a 4-hour session at 100%", () => {
    expect(shards(5 * HOUR, 10, 10)).toBe(shards(4 * HOUR, 10, 10));
    expect(shards(4 * HOUR, 10, 10)).toBe(24);
  });

  it("a session just under the cap is not clipped", () => {
    expect(shards(cap - 1, 10, 10)).toBe(23);
    expect(shards(cap - 1, 10, 10)).toBeLessThan(shards(cap, 10, 10));
  });
});

describe("custom config", () => {
  it("uses the given secondsPerShardUnit", () => {
    const config: EconomyConfig = { secondsPerShardUnit: 60, maxCountedSecondsPerSession: 7200 };
    expect(shards(HOUR, 10, 10)).toBe(6);
    expect(shards(HOUR, 10, 10, config)).toBe(60);
  });

  it("uses the given maxCountedSecondsPerSession", () => {
    const config: EconomyConfig = { secondsPerShardUnit: 60, maxCountedSecondsPerSession: 1200 };
    expect(shards(HOUR, 10, 10, config)).toBe(20);
  });

  it("rejects an unusable config", () => {
    expect(() => shards(HOUR, 1, 1, { secondsPerShardUnit: 0, maxCountedSecondsPerSession: 100 })).toThrow(RangeError);
    expect(() => shards(HOUR, 1, 1, { secondsPerShardUnit: 60.5, maxCountedSecondsPerSession: 100 })).toThrow(
      RangeError,
    );
    expect(() => shards(HOUR, 1, 1, { secondsPerShardUnit: 60, maxCountedSecondsPerSession: -1 })).toThrow(RangeError);
  });
});

describe("exactness sweep", () => {
  it("matches an exact BigInt computation for every combination", () => {
    const unit = BigInt(economy.secondsPerShardUnit);
    const cap = economy.maxCountedSecondsPerSession;
    const mismatches: string[] = [];
    let combinations = 0;

    for (let duration = 0; duration <= cap; duration += 30) {
      for (let total = 1; total <= 10; total += 1) {
        for (let correct = 0; correct <= total; correct += 1) {
          combinations += 1;
          const counted = BigInt(Math.min(duration, cap));
          const expected = Number((counted * BigInt(correct)) / (BigInt(total) * unit));
          const actual = shards(duration, correct, total);
          if (actual !== expected) {
            mismatches.push(`${duration}s ${correct}/${total}: expected ${expected}, got ${actual}`);
          }
        }
      }
    }

    expect(combinations).toBeGreaterThan(30000);
    expect(mismatches).toEqual([]);
  });
});

describe("invalid input", () => {
  const valid: ShardInput = { durationSeconds: 600, correctAnswers: 1, totalQuestions: 2 };
  const throwsRangeError = (override: Partial<ShardInput>) =>
    expect(() => calculateShards({ ...valid, ...override })).toThrow(RangeError);

  it("accepts the valid baseline", () => {
    expect(() => calculateShards(valid)).not.toThrow();
  });

  it("rejects fractional durationSeconds", () => {
    throwsRangeError({ durationSeconds: 600.5 });
  });

  it("rejects negative durationSeconds", () => {
    throwsRangeError({ durationSeconds: -1 });
  });

  it("rejects zero or negative totalQuestions", () => {
    throwsRangeError({ totalQuestions: 0, correctAnswers: 0 });
    throwsRangeError({ totalQuestions: -3, correctAnswers: 0 });
  });

  it("rejects correctAnswers greater than totalQuestions", () => {
    throwsRangeError({ correctAnswers: 3, totalQuestions: 2 });
  });

  it("rejects negative correctAnswers", () => {
    throwsRangeError({ correctAnswers: -1 });
  });

  it("rejects non-integer counts", () => {
    throwsRangeError({ correctAnswers: 1.5, totalQuestions: 3 });
    throwsRangeError({ correctAnswers: 1, totalQuestions: 2.5 });
  });

  it("rejects NaN in every field", () => {
    throwsRangeError({ durationSeconds: Number.NaN });
    throwsRangeError({ correctAnswers: Number.NaN });
    throwsRangeError({ totalQuestions: Number.NaN });
  });

  it("rejects Infinity in every field", () => {
    throwsRangeError({ durationSeconds: Number.POSITIVE_INFINITY });
    throwsRangeError({ correctAnswers: Number.POSITIVE_INFINITY });
    throwsRangeError({ totalQuestions: Number.POSITIVE_INFINITY });
    throwsRangeError({ durationSeconds: Number.NEGATIVE_INFINITY });
  });

  it("throws a message that names the bad field", () => {
    expect(() => calculateShards({ ...valid, correctAnswers: 5 })).toThrow(/correctAnswers/);
    expect(() => calculateShards({ ...valid, durationSeconds: -5 })).toThrow(/durationSeconds/);
  });
});
