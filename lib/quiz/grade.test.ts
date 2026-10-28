import { describe, expect, it } from "vitest";
import { gradeQuiz } from "./grade";
import type { QuizQuestion } from "./types";

const questions: QuizQuestion[] = [
  { question: "Q1", options: ["a", "b", "c", "d"], correctIndex: 0 },
  { question: "Q2", options: ["a", "b", "c", "d"], correctIndex: 3 },
  { question: "Q3", options: ["a", "b", "c", "d"], correctIndex: 2 },
];

describe("gradeQuiz", () => {
  it("scores all correct", () => {
    const grade = gradeQuiz(questions, [0, 3, 2]);
    expect(grade.correctAnswers).toBe(3);
    expect(grade.totalQuestions).toBe(3);
    expect(grade.results.every((result) => result.correct)).toBe(true);
  });

  it("scores all wrong", () => {
    const grade = gradeQuiz(questions, [1, 0, 0]);
    expect(grade.correctAnswers).toBe(0);
    expect(grade.results.some((result) => result.correct)).toBe(false);
  });

  it("scores a mixed result and reports each question", () => {
    const grade = gradeQuiz(questions, [0, 1, 2]);
    expect(grade.correctAnswers).toBe(2);
    expect(grade.results).toEqual([
      { correctIndex: 0, chosenIndex: 0, correct: true },
      { correctIndex: 3, chosenIndex: 1, correct: false },
      { correctIndex: 2, chosenIndex: 2, correct: true },
    ]);
  });

  it("throws RangeError when the answer count does not match", () => {
    expect(() => gradeQuiz(questions, [0, 3])).toThrow(RangeError);
    expect(() => gradeQuiz(questions, [0, 3, 2, 1])).toThrow(RangeError);
    expect(() => gradeQuiz(questions, [])).toThrow(RangeError);
  });

  it("throws RangeError for out-of-range answers", () => {
    expect(() => gradeQuiz(questions, [0, 4, 2])).toThrow(RangeError);
    expect(() => gradeQuiz(questions, [-1, 3, 2])).toThrow(RangeError);
  });

  it("throws RangeError for fractional or non-finite answers", () => {
    expect(() => gradeQuiz(questions, [0.5, 3, 2])).toThrow(RangeError);
    expect(() => gradeQuiz(questions, [0, Number.NaN, 2])).toThrow(RangeError);
    expect(() => gradeQuiz(questions, [0, 3, Number.POSITIVE_INFINITY])).toThrow(RangeError);
  });

  it("throws RangeError for non-number answers", () => {
    expect(() => gradeQuiz(questions, [0, "3" as unknown as number, 2])).toThrow(RangeError);
    expect(() => gradeQuiz(questions, [0, null as unknown as number, 2])).toThrow(RangeError);
  });
});
