// Development-only testing tools. None of this does anything when NODE_ENV is "production".

/** The only amounts the dev "add minutes" action accepts. */
export const devTimerMinutes = [5, 10, 30, 60] as const;

export type DevTimerMinutes = (typeof devTimerMinutes)[number];
