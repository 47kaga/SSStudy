import { describe, expect, it } from "vitest";
import { toPublicQuiz } from "./public";
import type { QuizQuestion } from "./types";

const questions: QuizQuestion[] = [
  { question: "Q1", options: ["a", "b", "c", "d"], correctIndex: 2 },
  { question: "Q2", options: ["e", "f", "g", "h"], correctIndex: 0 },
];

describe("toPublicQuiz", () => {
  it("keeps question text and options", () => {
    expect(toPublicQuiz(questions)).toEqual([
      { question: "Q1", options: ["a", "b", "c", "d"] },
      { question: "Q2", options: ["e", "f", "g", "h"] },
    ]);
  });

  it("contains no correctIndex key anywhere in the serialized output", () => {
    const json = JSON.stringify({ quiz: toPublicQuiz(questions), meta: { model: "m" } });
    expect(json).not.toContain("correctIndex");
    expect(json).not.toMatch(/correct/i);
  });

  it("drops extra fields smuggled onto a stored question", () => {
    const sneaky = { ...questions[0], answer: "c", explanation: "because" };
    const json = JSON.stringify(toPublicQuiz([sneaky]));
    expect(json).not.toContain("answer");
    expect(json).not.toContain("explanation");
    expect(json).not.toContain("correctIndex");
  });

  it("does not share option arrays with the input", () => {
    const result = toPublicQuiz(questions);
    result[0].options.push("x");
    expect(questions[0].options).toHaveLength(4);
  });
});
