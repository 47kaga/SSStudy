import "server-only";
import { randomInt } from "node:crypto";
import { quiz, quizSystemPrompt, quizTool, quizToolName } from "@/data/quiz";
import { db } from "@/lib/db";
import { getAnthropic, MissingApiKeyError } from "./anthropic";
import { buildMaterialMessage } from "./prompt";
import { toPublicQuiz } from "./public";
import { shuffleOptions } from "./shuffle";
import type { PublicQuestion } from "./types";
import { validateModelOutput } from "./validate";

export type QuizMeta = {
  model: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type GenerateResult =
  | { ok: true; quizId: number; publicQuiz: PublicQuestion[]; meta: QuizMeta }
  | { ok: false; code: "rate-limited" | "insufficient" | "model-failure" | "missing-key"; message: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const RANDOM_RANGE = 2 ** 32;

// Uniform float in [0, 1) from the OS random source, used only to shuffle option order.
function secureRandom(): number {
  return randomInt(RANDOM_RANGE) / RANDOM_RANGE;
}

function failure(code: "model-failure"): GenerateResult {
  return { ok: false, code, message: "Quiz generation failed. Try again." };
}

/** `sourceText` must already have passed normalizeSource. It is never stored. */
export async function generateQuiz(sourceText: string): Promise<GenerateResult> {
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

  const startedAt = Date.now();
  let message;
  try {
    message = await client.messages.create(
      {
        model: quiz.model,
        max_tokens: quiz.maxOutputTokens,
        system: quizSystemPrompt,
        tools: [quizTool],
        tool_choice: { type: "tool", name: quizToolName },
        messages: [{ role: "user", content: buildMaterialMessage(sourceText) }],
      },
      { timeout: quiz.requestTimeoutMs },
    );
  } catch (error) {
    // Log details server-side only; never put them in the response.
    console.error("[quiz] Anthropic request failed:", error instanceof Error ? error.message : "unknown error");
    return failure("model-failure");
  }
  const latencyMs = Date.now() - startedAt;

  if (message.stop_reason === "max_tokens") {
    console.error("[quiz] Model output was cut off by max_tokens.");
    return failure("model-failure");
  }

  const toolCall = message.content.find((block) => block.type === "tool_use" && block.name === quizToolName);
  if (!toolCall || toolCall.type !== "tool_use") {
    console.error("[quiz] Response had no submit_quiz tool call.");
    return failure("model-failure");
  }

  const output = validateModelOutput(toolCall.input);
  if (output.kind === "insufficient") {
    return { ok: false, code: "insufficient", message: output.reason };
  }
  if (output.kind === "invalid") {
    console.error("[quiz] Model output failed validation:", output.message);
    return failure("model-failure");
  }

  const shuffled = output.questions.map((question) => shuffleOptions(question, secureRandom));
  const inputTokens = message.usage?.input_tokens ?? null;
  const outputTokens = message.usage?.output_tokens ?? null;

  const row = await db.quiz.create({
    data: {
      model: message.model,
      questionsJson: JSON.stringify(shuffled),
      sourceChars: sourceText.length,
      inputTokens,
      outputTokens,
      latencyMs,
      totalQuestions: shuffled.length,
    },
  });

  return {
    ok: true,
    quizId: row.id,
    publicQuiz: toPublicQuiz(shuffled),
    meta: { model: message.model, latencyMs, inputTokens, outputTokens },
  };
}
