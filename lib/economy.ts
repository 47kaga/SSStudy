// Pure shard formula. No React, Next, Prisma or server-only imports.
import { economy, type EconomyConfig } from "@/data/economy";

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
