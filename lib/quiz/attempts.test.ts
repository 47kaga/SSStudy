import { describe, expect, it } from "vitest";
import { quiz, quizRetryFeedback } from "@/data/quiz";
import { runQuizAttempts, type CallModel, type ModelCall } from "./attempts";

const LENGTHS = [26, 28, 30, 32];

function option(index: number, length: number): string {
  return String.fromCharCode(97 + index).repeat(length);
}

/** A valid quiz whose correct answer is always at `correctIndex` of LENGTHS (1 = middle, 3 = longest). */
function quizInput(correctIndex: number) {
  return {
    status: "ok",
    questions: Array.from({ length: quiz.questionCount }, (_, n) => ({
      question: `Question ${n + 1}?`,
      options: LENGTHS.map((length, index) => option(index, length)),
      correctIndex,
    })),
  };
}

const balancedInput = () => quizInput(1);
const biasedInput = () => quizInput(3); // correct is the unique longest in every question
const invalidInput = () => ({ status: "ok", questions: [] });

function call(toolInput: unknown, inputTokens: number | null = 100, outputTokens: number | null = 50): ModelCall {
  return { toolInput, inputTokens, outputTokens };
}

/** A fake model that returns the given calls in order and records the feedback it was given. */
function fakeModel(...calls: ModelCall[]) {
  const feedback: (string | undefined)[] = [];
  const callModel: CallModel = async (given) => {
    feedback.push(given);
    const next = calls[Math.min(feedback.length - 1, calls.length - 1)];
    return next;
  };
  return { callModel, feedback };
}

describe("runQuizAttempts", () => {
  it("returns a valid balanced quiz on the first attempt with no feedback", async () => {
    const model = fakeModel(call(balancedInput()));
    const result = await runQuizAttempts(model.callModel);

    expect(result.kind).toBe("quiz");
    expect(result.attempts).toBe(1);
    expect(model.feedback).toEqual([undefined]);
  });

  it("retries a biased quiz with the length feedback, then accepts a balanced one", async () => {
    const model = fakeModel(call(biasedInput()), call(balancedInput()));
    const result = await runQuizAttempts(model.callModel);

    expect(result.kind).toBe("quiz");
    expect(result.attempts).toBe(2);
    expect(model.feedback).toEqual([undefined, quizRetryFeedback.unbalanced]);
  });

  it("retries structurally invalid output with the generic feedback", async () => {
    const model = fakeModel(call(invalidInput()), call(balancedInput()));
    const result = await runQuizAttempts(model.callModel);

    expect(result.kind).toBe("quiz");
    expect(result.attempts).toBe(2);
    expect(model.feedback).toEqual([undefined, quizRetryFeedback.invalid]);
  });

  it("fails when every attempt is biased, and says the last failure was imbalance", async () => {
    const model = fakeModel(call(biasedInput()), call(biasedInput()));
    const result = await runQuizAttempts(model.callModel);

    expect(result.kind).toBe("failed");
    if (result.kind === "failed") expect(result.failure).toBe("unbalanced");
    expect(result.attempts).toBe(2);
  });

  it("reports the kind of the last failure, not the first", async () => {
    const model = fakeModel(call(biasedInput()), call(invalidInput()));
    const result = await runQuizAttempts(model.callModel);

    expect(result.kind).toBe("failed");
    if (result.kind === "failed") expect(result.failure).toBe("invalid");
  });

  it("returns an insufficient result at once without retrying", async () => {
    const model = fakeModel(call({ status: "insufficient", reason: "Too short." }), call(balancedInput()));
    const result = await runQuizAttempts(model.callModel);

    expect(result).toMatchObject({ kind: "insufficient", reason: "Too short.", attempts: 1 });
    expect(model.feedback).toHaveLength(1);
  });

  it("returns insufficient from a retry too", async () => {
    const model = fakeModel(call(biasedInput()), call({ status: "insufficient", reason: "Too short." }));
    const result = await runQuizAttempts(model.callModel);

    expect(result).toMatchObject({ kind: "insufficient", attempts: 2 });
  });

  it("sums token usage across attempts", async () => {
    const model = fakeModel(call(biasedInput(), 1000, 400), call(balancedInput(), 1100, 450));
    const result = await runQuizAttempts(model.callModel);

    expect(result).toMatchObject({ inputTokens: 2100, outputTokens: 850 });
  });

  it("sums usage on failure too, and keeps null when no attempt reported tokens", async () => {
    const failed = await runQuizAttempts(fakeModel(call(biasedInput(), 10, 5), call(biasedInput(), 20, 6)).callModel);
    expect(failed).toMatchObject({ inputTokens: 30, outputTokens: 11 });

    const unknown = await runQuizAttempts(fakeModel(call(balancedInput(), null, null)).callModel);
    expect(unknown).toMatchObject({ inputTokens: null, outputTokens: null });
  });

  it("never calls the model more than maxAttempts times", async () => {
    const defaults = fakeModel(call(invalidInput()));
    await runQuizAttempts(defaults.callModel);
    expect(defaults.feedback).toHaveLength(quiz.maxAttempts);

    const three = fakeModel(call(biasedInput()));
    const result = await runQuizAttempts(three.callModel, { maxAttempts: 3 });
    expect(three.feedback).toHaveLength(3);
    expect(result.attempts).toBe(3);

    const single = fakeModel(call(biasedInput()));
    await runQuizAttempts(single.callModel, { maxAttempts: 1 });
    expect(single.feedback).toHaveLength(1);
  });

  it("tells onRetry why the attempt was rejected, and only when a retry follows", async () => {
    const seen: string[] = [];
    const model = fakeModel(call(biasedInput()), call(biasedInput()));
    await runQuizAttempts(model.callModel, { onRetry: (info) => seen.push(`${info.attempt}:${info.failure}`) });

    expect(seen).toEqual(["1:unbalanced"]);
  });

  it("does not catch errors from the model call", async () => {
    const callModel: CallModel = async () => {
      throw new Error("network");
    };
    await expect(runQuizAttempts(callModel)).rejects.toThrow("network");
  });

  it("rejects a maxAttempts below 1", async () => {
    await expect(runQuizAttempts(fakeModel(call(balancedInput())).callModel, { maxAttempts: 0 })).rejects.toThrow(RangeError);
  });
});
