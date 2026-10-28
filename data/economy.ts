// Game data for the shard economy. Starting values: change them here, not in the logic.

/** The two constants the shard formula itself needs. */
export type EconomyConfig = {
  /** Seconds of study that make up one shard unit (600 = 10 minutes). */
  secondsPerShardUnit: number;
  /** A single session counts at most this many seconds toward shards. */
  maxCountedSecondsPerSession: number;
};

/** The limits that decide whether a session earns anything, and how much per day. */
export type RewardLimits = {
  /** A session shorter than this cannot unlock a quiz. Exactly this long is allowed. */
  minSessionSeconds: number;
  /** Seconds of study the pasted material supports per character (300 characters = 10 minutes). */
  secondsPerSourceChar: number;
  /** Most shards earned from sessions inside the rolling window. */
  dailyShardCap: number;
  /** Length of the rolling window the daily cap is counted over. */
  dailyWindowSeconds: number;
};

export type AwardConfig = EconomyConfig & RewardLimits;

export const economy = {
  secondsPerShardUnit: 600, // 10 minutes of study = 1 unit
  maxCountedSecondsPerSession: 14400, // a single session counts at most 4 hours
  minSessionSeconds: 600, // under 10 minutes unlocks no quiz
  secondsPerSourceChar: 2, // 300 characters of material supports 10 minutes
  dailyShardCap: 30, // shards from sessions per rolling window
  dailyWindowSeconds: 86400, // rolling 24 hours, not a calendar day
} as const satisfies AwardConfig;
