// The generate-validate-balance-retry loop. No React, Next, Prisma, SDK or server-only imports:
// the model call is injected, so retries can be unit tested with fakes.
import { quiz, quizRetryFeedback } from "@/data/quiz";
import { checkBalance, type BalanceLimits } from "./balance";
import type { QuizQuestion } from "./types";
import { validateModelOutput, type ValidationLimits } from "./validate";

export type ModelCall = {
  toolInput: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type CallModel = (feedback?: string) => Promise<ModelCall>;

export type FailureKind = "invalid" | "unbalanced";

export type AttemptOptions = {
  maxAttempts: number;
  validation: ValidationLimits;
  balance: BalanceLimits;
  feedback: { unbalanced: string; invalid: string };
  /** Called just before a retry, with why the previous attempt was rejected. */
  onRetry?: (info: { attempt: number; failure: FailureKind; message: string }) => void;
};

type Usage = { attempts: number; inputTokens: number | null; outputTokens: number | null };

export type AttemptsResult =
  | ({ kind: "quiz"; questions: QuizQuestion[] } & Usage)
  | ({ kind: "insufficient"; reason: string } & Usage)
  | ({ kind: "failed"; failure: FailureKind; message: string } & Usage);

function addTokens(total: number | null, next: number | null): number | null {
  if (next === null) return total;
  return (total ?? 0) + next;
}

/**
 * Calls the model until it returns a valid, balanced quiz, up to `maxAttempts` calls in total.
 * An "insufficient" answer is returned at once. Token usage is summed over every attempt (null if none
 * reported any). Errors thrown by `callModel` are not retried and propagate to the caller.
 */
export async function runQuizAttempts(
  callModel: CallModel,
  options: Partial<AttemptOptions> = {},
): Promise<AttemptsResult> {
  const config: AttemptOptions = {
    maxAttempts: quiz.maxAttempts,
    validation: quiz,
    balance: quiz,
    feedback: quizRetryFeedback,
    ...options,
  };
  if (!Number.isInteger(config.maxAttempts) || config.maxAttempts < 1) {
    throw new RangeError("maxAttempts must be an integer of at least 1.");
  }

  let feedback: string | undefined;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let last: { failure: FailureKind; message: string } = { failure: "invalid", message: "No attempt was made." };

  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    const call = await callModel(feedback);
    inputTokens = addTokens(inputTokens, call.inputTokens);
    outputTokens = addTokens(outputTokens, call.outputTokens);
    const usage: Usage = { attempts: attempt, inputTokens, outputTokens };

    const output = validateModelOutput(call.toolInput, config.validation);
    if (output.kind === "insufficient") return { kind: "insufficient", reason: output.reason, ...usage };

    if (output.kind === "invalid") {
      last = { failure: "invalid", message: output.message };
    } else {
      const balance = checkBalance(output.questions, config.balance);
      if (balance.ok) return { kind: "quiz", questions: output.questions, ...usage };
      last = { failure: "unbalanced", message: balance.message };
    }

    if (attempt < config.maxAttempts) {
      config.onRetry?.({ attempt, ...last });
      feedback = config.feedback[last.failure];
    }
  }

  return { kind: "failed", ...last, attempts: config.maxAttempts, inputTokens, outputTokens };
}
