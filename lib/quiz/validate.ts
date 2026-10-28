// Pure validation of untrusted model output. No React, Next, Prisma, SDK or server-only imports.
// The model's JSON is never trusted: only known fields are copied into the result.
import { quiz } from "@/data/quiz";
import type { QuizQuestion } from "./types";

export type ValidationLimits = {
  /** Exact number of questions the output must contain. */
  expectedQuestions: number;
  optionsPerQuestion: number;
  maxQuestionChars: number;
  maxOptionChars: number;
  maxReasonChars: number;
};

export type ModelOutputResult =
  | { kind: "quiz"; questions: QuizQuestion[] }
  | { kind: "insufficient"; reason: string }
  | { kind: "invalid"; message: string };

type ParsedQuestion = { ok: true; question: QuizQuestion } | { ok: false; message: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameOptionKey(option: string): string {
  return option.replace(/\s+/g, " ").toLowerCase();
}

function parseQuestion(raw: unknown, index: number, limits: ValidationLimits): ParsedQuestion {
  const label = `Question ${index + 1}`;
  if (!isPlainObject(raw)) return { ok: false, message: `${label} is not an object.` };

  if (typeof raw.question !== "string") return { ok: false, message: `${label} has no question text.` };
  const question = raw.question.trim();
  if (question.length === 0) return { ok: false, message: `${label} text is empty.` };
  if (question.length > limits.maxQuestionChars) {
    return { ok: false, message: `${label} text is longer than ${limits.maxQuestionChars} characters.` };
  }

  if (!Array.isArray(raw.options)) return { ok: false, message: `${label} has no options array.` };
  if (raw.options.length !== limits.optionsPerQuestion) {
    return { ok: false, message: `${label} has ${raw.options.length} options, expected ${limits.optionsPerQuestion}.` };
  }

  const options: string[] = [];
  const seen = new Set<string>();
  for (const [optionIndex, rawOption] of raw.options.entries()) {
    if (typeof rawOption !== "string") {
      return { ok: false, message: `${label} option ${optionIndex + 1} is not a string.` };
    }
    const option = rawOption.trim();
    if (option.length === 0) return { ok: false, message: `${label} option ${optionIndex + 1} is empty.` };
    if (option.length > limits.maxOptionChars) {
      return {
        ok: false,
        message: `${label} option ${optionIndex + 1} is longer than ${limits.maxOptionChars} characters.`,
      };
    }
    const key = sameOptionKey(option);
    if (seen.has(key)) return { ok: false, message: `${label} has duplicate options.` };
    seen.add(key);
    options.push(option);
  }

  const { correctIndex } = raw;
  if (typeof correctIndex !== "number" || !Number.isInteger(correctIndex)) {
    return { ok: false, message: `${label} correctIndex is not an integer.` };
  }
  if (correctIndex < 0 || correctIndex >= limits.optionsPerQuestion) {
    return { ok: false, message: `${label} correctIndex ${correctIndex} is out of range.` };
  }

  return { ok: true, question: { question, options, correctIndex } };
}

/** What the model is asked for: the candidate pool, from which the final quiz is selected. */
export const candidateLimits: ValidationLimits = { ...quiz, expectedQuestions: quiz.candidateQuestions };

/** What a finished (selected and stored) quiz must contain. */
export const finalQuizLimits: ValidationLimits = { ...quiz, expectedQuestions: quiz.questionCount };

export function validateModelOutput(raw: unknown, limits: ValidationLimits = candidateLimits): ModelOutputResult {
  if (!isPlainObject(raw)) return { kind: "invalid", message: "Model output is not an object." };

  if (raw.status === "insufficient") {
    const reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
    if (reason.length === 0) return { kind: "invalid", message: "Insufficient result has no reason." };
    return { kind: "insufficient", reason: reason.slice(0, limits.maxReasonChars) };
  }
  if (raw.status !== "ok") return { kind: "invalid", message: "Model output has an unknown status." };

  if (!Array.isArray(raw.questions)) return { kind: "invalid", message: "Model output has no questions array." };
  if (raw.questions.length !== limits.expectedQuestions) {
    return {
      kind: "invalid",
      message: `Model returned ${raw.questions.length} questions, expected ${limits.expectedQuestions}.`,
    };
  }

  const questions: QuizQuestion[] = [];
  for (const [index, rawQuestion] of raw.questions.entries()) {
    const parsed = parseQuestion(rawQuestion, index, limits);
    if (!parsed.ok) return { kind: "invalid", message: parsed.message };
    questions.push(parsed.question);
  }
  return { kind: "quiz", questions };
}
