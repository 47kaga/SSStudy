// Pure grading. No React, Next, Prisma, SDK or server-only imports.
import type { GradeResult, QuizQuestion } from "./types";

/** Throws RangeError if answers do not line up with the questions. Callers map that to a 400. */
export function gradeQuiz(questions: readonly QuizQuestion[], answers: readonly number[]): GradeResult {
  if (answers.length !== questions.length) {
    throw new RangeError(`Expected ${questions.length} answers, got ${answers.length}.`);
  }

  const results = questions.map((question, index) => {
    const chosenIndex = answers[index];
    if (!Number.isInteger(chosenIndex)) {
      throw new RangeError(`Answer ${index + 1} must be an integer, got ${String(chosenIndex)}.`);
    }
    if (chosenIndex < 0 || chosenIndex >= question.options.length) {
      throw new RangeError(`Answer ${index + 1} (${chosenIndex}) is out of range.`);
    }
    return { correctIndex: question.correctIndex, chosenIndex, correct: chosenIndex === question.correctIndex };
  });

  return {
    correctAnswers: results.filter((result) => result.correct).length,
    totalQuestions: questions.length,
    results,
  };
}
