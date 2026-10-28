import "server-only";
import { randomInt } from "node:crypto";
import { quiz, quizSystemPrompt, quizTool, quizToolName } from "@/data/quiz";
import { db } from "@/lib/db";
import { checkSessionUnlock } from "@/lib/rewards";
import { Prisma } from "@/generated/prisma/client";
import { getAnthropic, MissingApiKeyError } from "./anthropic";
import { runQuizAttempts, type CallModel } from "./attempts";
import { buildMaterialMessage } from "./prompt";
import { toPublicQuiz } from "./public";
import { shuffleOptions } from "./shuffle";
import type { PublicQuestion } from "./types";

export type QuizMeta = {
  model: string;
  /** Total time across all attempts. */
  latencyMs: number;
  /** Summed across all attempts. */
  inputTokens: number | null;
  outputTokens: number | null;
  attempts: number;
};

export type GenerateResult =
  | { ok: true; quizId: number; publicQuiz: PublicQuestion[]; meta: QuizMeta }
  | {
      ok: false;
      code:
        | "rate-limited"
        | "insufficient"
        | "model-failure"
        | "missing-key"
        | "session-not-found"
        | "too-short"
        | "already-has-quiz";
      message: string;
    };

const DAY_MS = 24 * 60 * 60 * 1000;
const RANDOM_RANGE = 2 ** 32;

/** The Anthropic request itself failed (network, API error, timeout). Not retried. */
class ModelRequestError extends Error {}

// Uniform float in [0, 1) from the OS random source, used only to shuffle option order.
function secureRandom(): number {
  return randomInt(RANDOM_RANGE) / RANDOM_RANGE;
}

/** Keys and value types of invalid tool input, for the log. Never the values themselves. */
function shapeNote(inputShape: string | undefined): string {
  return inputShape ? ` Tool input was { ${inputShape} }.` : "";
}

function failure(code: "model-failure"): GenerateResult {
  return { ok: false, code, message: "Quiz generation failed. Try again." };
}

const SESSION_MESSAGES = {
  "session-not-found": "Session not found, or it has not ended yet.",
  "too-short": "This session was too short to unlock a quiz.",
  "already-has-quiz": "This session already has a quiz.",
} as const;

/**
 * `sourceText` must already have passed normalizeSource. It is never stored. With a `sessionId` the quiz
 * unlocks (and later pays for) that study session, and the session is checked before anything else, so a
 * refused request never reaches the API. Without one it is a lab quiz that awards nothing.
 */
export async function generateQuiz(sourceText: string, sessionId: number | null = null): Promise<GenerateResult> {
  if (sessionId !== null) {
    const unlock = await checkSessionUnlock(sessionId);
    if (!unlock.ok) return { ok: false, code: unlock.code, message: SESSION_MESSAGES[unlock.code] };
  }

  const since = new Date(Date.now() - DAY_MS);
  const recent = await db.quiz.count({ where: { createdAt: { gte: since } } });
  if (recent >= quiz.generationsPer24h) {
    return {
      ok: false,
      code: "rate-limited",
      message: `Daily limit of ${quiz.generationsPer24h} quizzes reached. Try again later.`,
    };
  }

  let client;
  try {
    client = getAnthropic();
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return { ok: false, code: "missing-key", message: "The quiz service is not configured on the server." };
    }
    throw error;
  }

  let modelName: string = quiz.model;
  const callModel: CallModel = async (feedback) => {
    let message;
    try {
      message = await client.messages.create(
        {
          model: quiz.model,
          max_tokens: quiz.maxOutputTokens,
          system: quizSystemPrompt,
          tools: [quizTool],
          tool_choice: { type: "tool", name: quizToolName },
          messages: [{ role: "user", content: buildMaterialMessage(sourceText, feedback) }],
        },
        { timeout: quiz.requestTimeoutMs },
      );
    } catch (error) {
      // Log details server-side only; never put them in the response.
      console.error("[quiz] Anthropic request failed:", error instanceof Error ? error.message : "unknown error");
      throw new ModelRequestError();
    }
    modelName = message.model;

    // A cut-off or tool-less response is treated as invalid output, so it can be retried.
    let toolInput: unknown;
    if (message.stop_reason === "max_tokens") {
      console.error("[quiz] Model output was cut off by max_tokens.");
    } else {
      const toolCall = message.content.find((block) => block.type === "tool_use" && block.name === quizToolName);
      if (toolCall && toolCall.type === "tool_use") toolInput = toolCall.input;
      else console.error("[quiz] Response had no submit_quiz tool call.");
    }

    return {
      toolInput,
      inputTokens: message.usage?.input_tokens ?? null,
      outputTokens: message.usage?.output_tokens ?? null,
    };
  };

  const startedAt = Date.now();
  let result;
  try {
    result = await runQuizAttempts(callModel, {
      onRetry: ({ attempt, failure: kind, message, inputShape }) =>
        console.error(`[quiz] Attempt ${attempt} rejected (${kind}): ${message}${shapeNote(inputShape)} Retrying.`),
    });
  } catch (error) {
    if (error instanceof ModelRequestError) return failure("model-failure");
    throw error;
  }
  const latencyMs = Date.now() - startedAt;

  if (result.kind === "insufficient") {
    return { ok: false, code: "insufficient", message: result.reason };
  }
  if (result.kind === "failed") {
    console.error(
      `[quiz] Gave up after ${result.attempts} attempts (${result.failure}): ${result.message}${shapeNote(result.inputShape)}`,
    );
    return failure("model-failure");
  }

  const shuffled = result.questions.map((question) => shuffleOptions(question, secureRandom));
  const { inputTokens, outputTokens, attempts } = result;

  let row;
  try {
    row = await db.quiz.create({
      data: {
        model: modelName,
        questionsJson: JSON.stringify(shuffled),
        sourceChars: sourceText.length,
        inputTokens,
        outputTokens,
        latencyMs,
        totalQuestions: shuffled.length,
        sessionId,
      },
    });
  } catch (error) {
    // Two requests for one session raced past the check: the unique index lets only the first store.
    if (sessionId !== null && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, code: "already-has-quiz", message: SESSION_MESSAGES["already-has-quiz"] };
    }
    throw error;
  }

  return {
    ok: true,
    quizId: row.id,
    publicQuiz: toPublicQuiz(shuffled),
    meta: { model: modelName, latencyMs, inputTokens, outputTokens, attempts },
  };
}
