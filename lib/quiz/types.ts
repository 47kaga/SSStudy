// Shared quiz types. No imports, so every quiz module can use them.

/** A full question, including the answer key. Server-side only until grading. */
export type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

/** What the browser may see before grading: no answer key. */
export type PublicQuestion = {
  question: string;
  options: string[];
};

export type QuestionResult = {
  correctIndex: number;
  chosenIndex: number;
  correct: boolean;
};

export type GradeResult = {
  correctAnswers: number;
  totalQuestions: number;
  results: QuestionResult[];
};
