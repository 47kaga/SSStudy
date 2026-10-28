// Game data for the shard economy. Starting values: change them here, not in the logic.

export type EconomyConfig = {
  /** Seconds of study that make up one shard unit (600 = 10 minutes). */
  secondsPerShardUnit: number;
  /** A single session counts at most this many seconds toward shards. */
  maxCountedSecondsPerSession: number;
};

export const economy = {
  secondsPerShardUnit: 600, // 10 minutes of study = 1 unit
  maxCountedSecondsPerSession: 14400, // a single session counts at most 4 hours
} as const satisfies EconomyConfig;
