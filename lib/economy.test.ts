import { describe, expect, it } from "vitest";
import { economy, type AwardConfig, type EconomyConfig } from "@/data/economy";
import { calculateAward, calculateShards, sessionEligibility, type AwardInput, type ShardInput } from "./economy";

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

describe("floating-point regression", () => {
  // countedSeconds * (correct / total) / unit gives 2.9999999999999996 here and floors to 2.
  it("2640 seconds at 15 of 22 gives exactly 3", () => {
    expect(shards(2640, 15, 22)).toBe(3);
  });
});

describe("exactness sweep", () => {
  // Step 1 covers every second but takes about 6s; step 7 keeps the suite fast with every total (1-100).
  const SWEEP_DURATION_STEP = 7;

  it("matches an exact BigInt computation for every combination", () => {
    const unit = BigInt(economy.secondsPerShardUnit);
    const cap = economy.maxCountedSecondsPerSession;
    const durations: number[] = [];
    for (let duration = 0; duration <= cap; duration += SWEEP_DURATION_STEP) durations.push(duration);
    durations.push(cap, cap + 1); // the cap boundary itself, and one second past it
    const mismatches: string[] = [];
    let combinations = 0;

    for (const duration of durations) {
      const counted = BigInt(Math.min(duration, cap));
      for (let total = 1; total <= 100; total += 1) {
        const denominator = BigInt(total) * unit;
        for (let correct = 0; correct <= total; correct += 1) {
          combinations += 1;
          const expected = Number((counted * BigInt(correct)) / denominator);
          const actual = shards(duration, correct, total);
          if (actual !== expected) {
            mismatches.push(`${duration}s ${correct}/${total}: expected ${expected}, got ${actual}`);
          }
        }
      }
    }

    expect(combinations).toBeGreaterThan(1_000_000);
    expect(mismatches).toEqual([]);
  }, 120_000);
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

// ---- Milestone 6: eligibility and awards ----

const award = (
  durationSeconds: number,
  sourceChars: number,
  correctAnswers = 10,
  totalQuestions = 10,
  earnedInWindow = 0,
  config?: AwardConfig,
) => calculateAward({ durationSeconds, sourceChars, correctAnswers, totalQuestions, earnedInWindow }, config);

describe("sessionEligibility", () => {
  it("rejects 599 seconds, accepts exactly 600 and 601", () => {
    expect(sessionEligibility(599)).toEqual({ eligible: false, reason: "too-short" });
    expect(sessionEligibility(600)).toEqual({ eligible: true });
    expect(sessionEligibility(601)).toEqual({ eligible: true });
  });

  it("accepts zero as too short", () => {
    expect(sessionEligibility(0)).toEqual({ eligible: false, reason: "too-short" });
  });

  it("uses the given minimum", () => {
    expect(sessionEligibility(59, { minSessionSeconds: 60 }).eligible).toBe(false);
    expect(sessionEligibility(60, { minSessionSeconds: 60 }).eligible).toBe(true);
  });

  it("rejects bad input", () => {
    expect(() => sessionEligibility(-1)).toThrow(RangeError);
    expect(() => sessionEligibility(1.5)).toThrow(RangeError);
    expect(() => sessionEligibility(Number.NaN)).toThrow(RangeError);
    expect(() => sessionEligibility(600, { minSessionSeconds: -1 })).toThrow(RangeError);
    expect(() => sessionEligibility(600, { minSessionSeconds: 1.5 })).toThrow(RangeError);
  });
});

describe("calculateAward: counted time and what limited it", () => {
  const cap = economy.maxCountedSecondsPerSession;
  const plenty = 100_000; // material that supports far more than the cap

  it("is limited by duration when the session is the shortest", () => {
    const result = award(1800, plenty);
    expect(result.countedSeconds).toBe(1800);
    expect(result.limitedBy).toBe("duration");
    expect(result.rawShards).toBe(3);
  });

  it("is limited by the session cap when the session is longer than the cap", () => {
    const result = award(5 * HOUR, plenty);
    expect(result.countedSeconds).toBe(cap);
    expect(result.limitedBy).toBe("session-cap");
    expect(result.rawShards).toBe(24);
  });

  it("is limited by the material when the paste is the smallest", () => {
    const result = award(2 * HOUR, 900); // 900 chars support 1800 seconds
    expect(result.countedSeconds).toBe(1800);
    expect(result.limitedBy).toBe("material");
    expect(result.rawShards).toBe(3);
  });

  it("300 characters support exactly 600 seconds, so a 4-hour session with 300 characters counts 600", () => {
    const result = award(4 * HOUR, 300);
    expect(result.countedSeconds).toBe(600);
    expect(result.limitedBy).toBe("material");
    expect(result.rawShards).toBe(1);
  });

  it("breaks ties in the order duration, session cap, material", () => {
    expect(award(1800, 900).limitedBy).toBe("duration"); // duration = material
    expect(award(cap, plenty).limitedBy).toBe("duration"); // duration = cap
    expect(award(cap, cap / 2).limitedBy).toBe("duration"); // all three equal
    expect(award(cap + 1, cap / 2).limitedBy).toBe("session-cap"); // cap = material, shorter than duration
  });

  it("counts nothing from an empty paste", () => {
    const result = award(HOUR, 0);
    expect(result.countedSeconds).toBe(0);
    expect(result.limitedBy).toBe("material");
    expect(result.awarded).toBe(0);
  });

  it("passes the inputs through to the breakdown", () => {
    const result = award(3000, plenty, 3, 5);
    expect(result).toMatchObject({ durationSeconds: 3000, correctAnswers: 3, totalQuestions: 5 });
    expect(result.rawShards).toBe(3); // floor(3000 * 3 / (5 * 600)) = 3
  });
});

describe("calculateAward: the daily cap", () => {
  const cap = economy.dailyShardCap;

  it("pays everything when the cap is not reached", () => {
    const result = award(HOUR, 100_000, 10, 10, 10);
    expect(result).toMatchObject({ rawShards: 6, dailyRemaining: cap - 10, cappedByDaily: false, awarded: 6 });
  });

  it("pays only what is left when the cap is partly used", () => {
    const result = award(HOUR, 100_000, 10, 10, cap - 4);
    expect(result).toMatchObject({ rawShards: 6, dailyRemaining: 4, cappedByDaily: true, awarded: 4 });
  });

  it("is not capped when the award exactly fits the remainder", () => {
    const result = award(HOUR, 100_000, 10, 10, cap - 6);
    expect(result).toMatchObject({ dailyRemaining: 6, cappedByDaily: false, awarded: 6 });
  });

  it("pays nothing when exactly at the cap", () => {
    const result = award(HOUR, 100_000, 10, 10, cap);
    expect(result).toMatchObject({ dailyRemaining: 0, cappedByDaily: true, awarded: 0 });
  });

  it("pays nothing when earnedInWindow is above the cap", () => {
    const result = award(HOUR, 100_000, 10, 10, cap + 50);
    expect(result).toMatchObject({ dailyRemaining: 0, cappedByDaily: true, awarded: 0 });
  });

  it("is not capped when there was nothing to pay anyway", () => {
    const result = award(HOUR, 100_000, 0, 10, cap);
    expect(result).toMatchObject({ rawShards: 0, cappedByDaily: false, awarded: 0 });
  });

  it("uses the given daily cap", () => {
    const config: AwardConfig = { ...economy, dailyShardCap: 2 };
    expect(award(HOUR, 100_000, 10, 10, 0, config)).toMatchObject({ awarded: 2, cappedByDaily: true });
  });
});

describe("calculateAward: exactness", () => {
  it("rawShards matches an exact BigInt computation", () => {
    const unit = BigInt(economy.secondsPerShardUnit);
    const sessionCap = economy.maxCountedSecondsPerSession;
    const sources = [0, 1, 299, 300, 301, 1800, 7200, 10_000];
    const mismatches: string[] = [];
    let combinations = 0;

    for (let duration = 0; duration <= sessionCap + 100; duration += 97) {
      for (const chars of sources) {
        const counted = BigInt(Math.min(duration, sessionCap, chars * economy.secondsPerSourceChar));
        for (let total = 1; total <= 30; total += 1) {
          for (let correct = 0; correct <= total; correct += 1) {
            combinations += 1;
            const expected = Number((counted * BigInt(correct)) / (BigInt(total) * unit));
            const actual = award(duration, chars, correct, total).rawShards;
            if (actual !== expected) mismatches.push(`${duration}s ${chars}ch ${correct}/${total}`);
          }
        }
      }
    }

    expect(combinations).toBeGreaterThan(100_000);
    expect(mismatches).toEqual([]);
  }, 60_000);
});

describe("calculateAward: invalid input", () => {
  const base: AwardInput = {
    durationSeconds: 3600,
    sourceChars: 1800,
    correctAnswers: 3,
    totalQuestions: 5,
    earnedInWindow: 0,
  };
  const bad = (override: Partial<AwardInput>) =>
    expect(() => calculateAward({ ...base, ...override })).toThrow(RangeError);

  it("accepts the baseline", () => {
    expect(() => calculateAward(base)).not.toThrow();
  });

  it("rejects bad durations", () => {
    bad({ durationSeconds: -1 });
    bad({ durationSeconds: 1.5 });
    bad({ durationSeconds: Number.NaN });
    bad({ durationSeconds: Number.POSITIVE_INFINITY });
  });

  it("rejects bad source sizes", () => {
    bad({ sourceChars: -1 });
    bad({ sourceChars: 1.5 });
    bad({ sourceChars: Number.NaN });
    bad({ sourceChars: Number.POSITIVE_INFINITY });
    bad({ sourceChars: Number.MAX_SAFE_INTEGER });
  });

  it("rejects bad scores", () => {
    bad({ totalQuestions: 0, correctAnswers: 0 });
    bad({ correctAnswers: 6 });
    bad({ correctAnswers: -1 });
    bad({ correctAnswers: 1.5 });
    bad({ totalQuestions: Number.NaN });
  });

  it("rejects bad earnedInWindow", () => {
    bad({ earnedInWindow: -1 });
    bad({ earnedInWindow: 1.5 });
    bad({ earnedInWindow: Number.NaN });
    bad({ earnedInWindow: Number.POSITIVE_INFINITY });
  });

  it("rejects an unusable config", () => {
    const run = (override: Partial<AwardConfig>) => () => calculateAward(base, { ...economy, ...override });
    expect(run({ secondsPerSourceChar: 0 })).toThrow(RangeError);
    expect(run({ secondsPerSourceChar: 1.5 })).toThrow(RangeError);
    expect(run({ dailyShardCap: -1 })).toThrow(RangeError);
    expect(run({ dailyShardCap: 1.5 })).toThrow(RangeError);
    expect(run({ dailyWindowSeconds: 0 })).toThrow(RangeError);
    expect(run({ secondsPerShardUnit: 0 })).toThrow(RangeError);
  });
});
