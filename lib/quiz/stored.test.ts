import { describe, expect, it } from "vitest";
import { quiz } from "@/data/quiz";
import { parseStoredQuestions } from "./stored";

const questions = Array.from({ length: quiz.questionCount }, (_, n) => ({
  question: `Question ${n}?`,
  options: ["a", "b", "c", "d"],
  correctIndex: n % 4,
}));

describe("parseStoredQuestions", () => {
  it("round-trips valid questions", () => {
    expect(parseStoredQuestions(JSON.stringify(questions))).toEqual(questions);
  });

  it("returns null for corrupt or malformed JSON", () => {
    expect(parseStoredQuestions("{not json")).toBeNull();
    expect(parseStoredQuestions("null")).toBeNull();
    expect(parseStoredQuestions("{}")).toBeNull();
    expect(parseStoredQuestions(JSON.stringify(questions.slice(1)))).toBeNull();
    expect(parseStoredQuestions(JSON.stringify([{ question: "x" }]))).toBeNull();
  });
});
