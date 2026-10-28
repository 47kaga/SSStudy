// Pure shard formula. No React, Next, Prisma or server-only imports.
import { economy, type AwardConfig, type EconomyConfig, type RewardLimits } from "@/data/economy";

export type ShardInput = {
  /** Whole seconds studied in the session. */
  durationSeconds: number;
  correctAnswers: number;
  totalQuestions: number;
};

function requireInteger(name: string, value: number): void {
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer, got ${value}`);
}

function validate({ durationSeconds, correctAnswers, totalQuestions }: ShardInput, config: EconomyConfig): void {
  requireInteger("durationSeconds", durationSeconds);
  if (durationSeconds < 0) throw new RangeError(`durationSeconds must not be negative, got ${durationSeconds}`);

  requireInteger("totalQuestions", totalQuestions);
  if (totalQuestions < 1) throw new RangeError(`totalQuestions must be at least 1, got ${totalQuestions}`);

  requireInteger("correctAnswers", correctAnswers);
  if (correctAnswers < 0) throw new RangeError(`correctAnswers must not be negative, got ${correctAnswers}`);
  if (correctAnswers > totalQuestions) {
    throw new RangeError(`correctAnswers (${correctAnswers}) must not exceed totalQuestions (${totalQuestions})`);
  }

  requireInteger("secondsPerShardUnit", config.secondsPerShardUnit);
  if (config.secondsPerShardUnit < 1) {
    throw new RangeError(`secondsPerShardUnit must be at least 1, got ${config.secondsPerShardUnit}`);
  }
  requireInteger("maxCountedSecondsPerSession", config.maxCountedSecondsPerSession);
  if (config.maxCountedSecondsPerSession < 0) {
    throw new RangeError(`maxCountedSecondsPerSession must not be negative, got ${config.maxCountedSecondsPerSession}`);
  }
}

/**
 * shards = floor(countedSeconds * correct / (total * secondsPerShardUnit))
 *
 * Counts are used instead of a float rating, and the division is done on whole numbers,
 * so scores like 2/3 never pick up floating-point error. Callers validate user-facing input;
 * this throws a RangeError on bad input so bugs fail loudly instead of paying out wrong amounts.
 */
export function calculateShards(input: ShardInput, config: EconomyConfig = economy): number {
  validate(input, config);

  const countedSeconds = Math.min(input.durationSeconds, config.maxCountedSecondsPerSession);
  const numerator = countedSeconds * input.correctAnswers;
  const denominator = input.totalQuestions * config.secondsPerShardUnit;
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    throw new RangeError("Input is too large to calculate shards exactly");
  }

  // Exact floored division: the remainder of two safe integers is exact, so no rounding can occur.
  return (numerator - (numerator % denominator)) / denominator;
}

export type Eligibility = { eligible: true } | { eligible: false; reason: "too-short" };

/** A session must last at least `minSessionSeconds` (exactly that long is allowed) to unlock a quiz. */
export function sessionEligibility(durationSeconds: number, config: Pick<RewardLimits, "minSessionSeconds"> = economy): Eligibility {
  requireInteger("durationSeconds", durationSeconds);
  if (durationSeconds < 0) throw new RangeError(`durationSeconds must not be negative, got ${durationSeconds}`);
  requirePositiveOrZeroInteger("minSessionSeconds", config.minSessionSeconds);

  return durationSeconds >= config.minSessionSeconds ? { eligible: true } : { eligible: false, reason: "too-short" };
}

export type AwardInput = ShardInput & {
  /** Characters of the material the quiz was generated from, as stored with the quiz. */
  sourceChars: number;
  /** Shards already earned from sessions inside the rolling window. */
  earnedInWindow: number;
};

/** What limited the counted time. Ties resolve in this order: duration, session cap, material. */
export type TimeLimit = "duration" | "session-cap" | "material";

export type AwardBreakdown = {
  durationSeconds: number;
  countedSeconds: number;
  limitedBy: TimeLimit;
  correctAnswers: number;
  totalQuestions: number;
  /** Shards from time and score alone, before the daily cap. */
  rawShards: number;
  /** How many more shards the daily cap still lets through. */
  dailyRemaining: number;
  cappedByDaily: boolean;
  /** What is actually paid. */
  awarded: number;
};

function requirePositiveOrZeroInteger(name: string, value: number): void {
  requireInteger(name, value);
  if (value < 0) throw new RangeError(`${name} must not be negative, got ${value}`);
}

/**
 * Time and score to a payout: counted time is the smallest of the session length, the per-session cap
 * and what the pasted material supports; the shard formula runs on that; the daily cap trims the rest.
 */
export function calculateAward(input: AwardInput, config: AwardConfig = economy): AwardBreakdown {
  requirePositiveOrZeroInteger("sourceChars", input.sourceChars);
  requirePositiveOrZeroInteger("earnedInWindow", input.earnedInWindow);
  requirePositiveOrZeroInteger("dailyShardCap", config.dailyShardCap);
  requireInteger("secondsPerSourceChar", config.secondsPerSourceChar);
  if (config.secondsPerSourceChar < 1) {
    throw new RangeError(`secondsPerSourceChar must be at least 1, got ${config.secondsPerSourceChar}`);
  }
  requireInteger("dailyWindowSeconds", config.dailyWindowSeconds);
  if (config.dailyWindowSeconds < 1) {
    throw new RangeError(`dailyWindowSeconds must be at least 1, got ${config.dailyWindowSeconds}`);
  }
  validate(input, config);

  const materialSeconds = input.sourceChars * config.secondsPerSourceChar;
  if (!Number.isSafeInteger(materialSeconds)) throw new RangeError("sourceChars is too large");

  const sessionCap = config.maxCountedSecondsPerSession;
  const countedSeconds = Math.min(input.durationSeconds, sessionCap, materialSeconds);
  let limitedBy: TimeLimit;
  if (input.durationSeconds <= sessionCap && input.durationSeconds <= materialSeconds) limitedBy = "duration";
  else if (sessionCap <= materialSeconds) limitedBy = "session-cap";
  else limitedBy = "material";

  const rawShards = calculateShards(
    { durationSeconds: countedSeconds, correctAnswers: input.correctAnswers, totalQuestions: input.totalQuestions },
    config,
  );
  const dailyRemaining = Math.max(0, config.dailyShardCap - input.earnedInWindow);
  return {
    durationSeconds: input.durationSeconds,
    countedSeconds,
    limitedBy,
    correctAnswers: input.correctAnswers,
    totalQuestions: input.totalQuestions,
    rawShards,
    dailyRemaining,
    cappedByDaily: rawShards > dailyRemaining,
    awarded: Math.min(rawShards, dailyRemaining),
  };
}

/**
 * How many characters of pasted material support `countedSeconds` of study: the smallest whole number of
 * characters whose supported time (`secondsPerSourceChar` each) is at least that long.
 */
export function materialCharsNeeded(
  countedSeconds: number,
  config: Pick<RewardLimits, "secondsPerSourceChar"> = economy,
): number {
  requirePositiveOrZeroInteger("countedSeconds", countedSeconds);
  requireInteger("secondsPerSourceChar", config.secondsPerSourceChar);
  if (config.secondsPerSourceChar < 1) {
    throw new RangeError(`secondsPerSourceChar must be at least 1, got ${config.secondsPerSourceChar}`);
  }
  // Exact ceiling division on whole numbers.
  const remainder = countedSeconds % config.secondsPerSourceChar;
  return (countedSeconds - remainder) / config.secondsPerSourceChar + (remainder === 0 ? 0 : 1);
}

export type BestCase = {
  /** The most seconds of this session that can count: the session length, trimmed by the session cap. */
  countedSeconds: number;
  /** The most this session could pay: a perfect score, enough material, and what is left of the daily cap. */
  maxShards: number;
  /** Material needed for all of `countedSeconds` to count. */
  materialCharsNeeded: number;
};

/** The best case for a finished session, from the same award rules as the real payout. */
export function bestCaseAward(
  input: { durationSeconds: number; earnedInWindow: number },
  config: AwardConfig = economy,
): BestCase {
  requirePositiveOrZeroInteger("durationSeconds", input.durationSeconds);
  const countedSeconds = Math.min(input.durationSeconds, config.maxCountedSecondsPerSession);
  const chars = materialCharsNeeded(countedSeconds, config);
  const award = calculateAward(
    {
      durationSeconds: input.durationSeconds,
      sourceChars: chars,
      correctAnswers: 1,
      totalQuestions: 1,
      earnedInWindow: input.earnedInWindow,
    },
    config,
  );
  return { countedSeconds: award.countedSeconds, maxShards: award.awarded, materialCharsNeeded: chars };
}
