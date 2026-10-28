import { describe, expect, it } from "vitest";
import { sessionQuizState } from "./session-quiz-state";

const base = { durationSeconds: 3600, hasQuiz: false, graded: false, shardsAwarded: 0 };

describe("sessionQuizState", () => {
  it("is too short under the minimum and eligible at exactly the minimum", () => {
    expect(sessionQuizState({ ...base, durationSeconds: 599 })).toEqual({ kind: "too-short" });
    expect(sessionQuizState({ ...base, durationSeconds: 600 })).toEqual({ kind: "quiz" });
  });

  it("offers a quiz when eligible and none is stored", () => {
    expect(sessionQuizState(base)).toEqual({ kind: "quiz" });
  });

  it("offers to resume when a quiz is stored but not graded", () => {
    expect(sessionQuizState({ ...base, hasQuiz: true })).toEqual({ kind: "resume" });
  });

  it("shows the shards once graded, including zero", () => {
    expect(sessionQuizState({ ...base, hasQuiz: true, graded: true, shardsAwarded: 4 })).toEqual({
      kind: "graded",
      shards: 4,
    });
    expect(sessionQuizState({ ...base, hasQuiz: true, graded: true })).toEqual({ kind: "graded", shards: 0 });
  });
});
