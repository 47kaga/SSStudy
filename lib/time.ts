// Pure time helpers. No React, Next or Prisma imports.

type Instant = Date | number;

function toMillis(value: Instant): number {
  return typeof value === "number" ? value : value.getTime();
}

/** Whole seconds between two instants. Never negative (a future start counts as 0). */
export function elapsedSeconds(startedAt: Instant, now: Instant): number {
  const seconds = Math.floor((toMillis(now) - toMillis(startedAt)) / 1000);
  return seconds > 0 ? seconds : 0;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

function twoDigits(value: number): string {
  return value.toString().padStart(2, "0");
}

/** Formats whole seconds as H:MM:SS. Negative or fractional input is clamped and floored. */
export function formatDuration(seconds: number): string {
  const total = seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = total % SECONDS_PER_MINUTE;
  return `${hours}:${twoDigits(minutes)}:${twoDigits(secs)}`;
}
