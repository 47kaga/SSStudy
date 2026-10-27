import { describe, expect, it } from "vitest";
import { elapsedSeconds, formatDuration } from "./time";

const start = new Date("2026-01-01T10:00:00.000Z");
const at = (offsetMs: number) => new Date(start.getTime() + offsetMs);

describe("elapsedSeconds", () => {
  it("is zero when now equals the start", () => {
    expect(elapsedSeconds(start, start)).toBe(0);
  });

  it("counts whole seconds under a minute and floors partial seconds", () => {
    expect(elapsedSeconds(start, at(42_000))).toBe(42);
    expect(elapsedSeconds(start, at(42_999))).toBe(42);
  });

  it("handles exactly an hour and more than an hour", () => {
    expect(elapsedSeconds(start, at(3_600_000))).toBe(3600);
    expect(elapsedSeconds(start, at(3_600_000 + 61_000))).toBe(3661);
  });

  it("clamps a start time in the future to zero", () => {
    expect(elapsedSeconds(at(5_000), start)).toBe(0);
  });

  it("accepts millisecond timestamps as well as dates", () => {
    expect(elapsedSeconds(start.getTime(), at(3_000).getTime())).toBe(3);
  });
});

describe("formatDuration", () => {
  it("formats zero", () => {
    expect(formatDuration(0)).toBe("0:00:00");
  });

  it("formats under a minute", () => {
    expect(formatDuration(7)).toBe("0:00:07");
    expect(formatDuration(59)).toBe("0:00:59");
  });

  it("formats exactly an hour", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
  });

  it("formats over an hour", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDuration(36_000 + 125)).toBe("10:02:05");
  });

  it("clamps negative input to zero", () => {
    expect(formatDuration(-30)).toBe("0:00:00");
  });
});
