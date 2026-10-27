import { describe, expect, it } from "vitest";
import { PROJECT_TITLE_MAX_LENGTH, validateProjectTitle } from "./project-title";

describe("validateProjectTitle", () => {
  it("trims surrounding whitespace", () => {
    expect(validateProjectTitle("  Biology  ")).toEqual({ ok: true, title: "Biology" });
  });

  it("rejects empty, blank and non-string input", () => {
    expect(validateProjectTitle("").ok).toBe(false);
    expect(validateProjectTitle("   ").ok).toBe(false);
    expect(validateProjectTitle(null).ok).toBe(false);
    expect(validateProjectTitle(42).ok).toBe(false);
  });

  it("accepts the maximum length and rejects one more", () => {
    expect(validateProjectTitle("a".repeat(PROJECT_TITLE_MAX_LENGTH)).ok).toBe(true);
    expect(validateProjectTitle("a".repeat(PROJECT_TITLE_MAX_LENGTH + 1)).ok).toBe(false);
  });
});
