// The generate-validate-select-retry loop. No React, Next, Prisma, SDK or server-only imports:
// the model call is injected, so retries can be unit tested with fakes.
import { quiz, quizRetryFeedback } from "@/data/quiz";
import { selectBalanced, type SelectLimits } from "./select";
import { describeShape } from "./shape";
import type { QuizQuestion } from "./types";
import { candidateLimits, validateModelOutput, type ValidationLimits } from "./validate";

export type ModelCall = {
  toolInput: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type CallModel = (feedback?: string) => Promise<ModelCall>;

export type FailureKind = "invalid" | "unbalanced";

/** Why an attempt was rejected. `inputShape` (keys and value types, never values) is set for "invalid". */
export type Rejection = { failure: FailureKind; message: string; inputShape?: string };

export type AttemptOptions = {
  maxAttempts: number;
  validation: ValidationLimits;
  balance: SelectLimits;
  feedback: { unbalanced: string; invalid: string };
  /** Called just before a retry, with why the previous attempt was rejected. */
  onRetry?: (info: Rejection & { attempt: number }) => void;
};

type Usage = { attempts: number; inputTokens: number | null; outputTokens: number | null };

export type AttemptsResult =
  | ({ kind: "quiz"; questions: QuizQuestion[] } & Usage)
  | ({ kind: "insufficient"; reason: string } & Usage)
  | ({ kind: "failed" } & Rejection & Usage);

function addTokens(total: number | null, next: number | null): number | null {
  if (next === null) return total;
  return (total ?? 0) + next;
}

/**
 * Calls the model until it returns a valid pool of candidate questions from which `selectBalanced` can
 * keep a balanced quiz, up to `maxAttempts` calls in total. An "insufficient" answer is returned at once.
 * Token usage is summed over every attempt (null if none reported any). Errors thrown by `callModel`
 * are not retried and propagate to the caller.
 */
export async function runQuizAttempts(
  callModel: CallModel,
  options: Partial<AttemptOptions> = {},
): Promise<AttemptsResult> {
  const config: AttemptOptions = {
    maxAttempts: quiz.maxAttempts,
    validation: candidateLimits,
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
  let last: Rejection = { failure: "invalid", message: "No attempt was made." };

  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    const call = await callModel(feedback);
    inputTokens = addTokens(inputTokens, call.inputTokens);
    outputTokens = addTokens(outputTokens, call.outputTokens);
    const usage: Usage = { attempts: attempt, inputTokens, outputTokens };

    const output = validateModelOutput(call.toolInput, config.validation);
    if (output.kind === "insufficient") return { kind: "insufficient", reason: output.reason, ...usage };

    if (output.kind === "invalid") {
      last = { failure: "invalid", message: output.message, inputShape: describeShape(call.toolInput) };
    } else {
      const selected = selectBalanced(output.questions, config.balance);
      if (selected) return { kind: "quiz", questions: selected, ...usage };
      last = {
        failure: "unbalanced",
        message: `No ${config.balance.questionCount} of the ${output.questions.length} questions met the option-length limits.`,
      };
    }

    if (attempt < config.maxAttempts) {
      config.onRetry?.({ attempt, ...last });
      feedback = config.feedback[last.failure];
    }
  }

  return { kind: "failed", ...last, attempts: config.maxAttempts, inputTokens, outputTokens };
}
