import { describe, expect, it } from "vitest";
import { quiz, quizRetryFeedback } from "@/data/quiz";
import { runQuizAttempts, type CallModel, type ModelCall } from "./attempts";

const LENGTHS = [26, 28, 30, 32];

function option(index: number, length: number): string {
  return String.fromCharCode(97 + index).repeat(length);
}

type PoolQuestion = { question: string; options: string[]; correctIndex: number };

function poolQuestion(n: number, lengths: number[], correctIndex: number): PoolQuestion {
  return { question: `Question ${n + 1}?`, options: lengths.map((length, index) => option(index, length)), correctIndex };
}

/** A candidate pool of `candidateQuestions` questions built by `make`. */
function pool(make: (n: number) => PoolQuestion) {
  return { status: "ok", questions: Array.from({ length: quiz.candidateQuestions }, (_, n) => make(n)) };
}

// Correct answer is a middle-length option: nothing to guess from.
const balancedInput = () => pool((n) => poolQuestion(n, LENGTHS, 1));
// Correct answer is the unique longest in every question: no subset can pass the tell limit.
const biasedInput = () => pool((n) => poolQuestion(n, LENGTHS, 3));
// Every option set is too uneven for the ratio rule: nothing survives the filter.
const unevenInput = () => pool((n) => poolQuestion(n, [20, 30, 50, 30], 1));
// Wrong shape: a string where the questions array belongs.
const invalidInput = () => ({ status: "ok", questions: "not an array", secretNote: "do not log this" });

function call(toolInput: unknown, inputTokens: number | null = 100, outputTokens: number | null = 50): ModelCall {
  return { toolInput, inputTokens, outputTokens };
}

/** A fake model that returns the given calls in order and records the feedback it was given. */
function fakeModel(...calls: ModelCall[]) {
  const feedback: (string | undefined)[] = [];
  const callModel: CallModel = async (given) => {
    feedback.push(given);
    return calls[Math.min(feedback.length - 1, calls.length - 1)];
  };
  return { callModel, feedback };
}

describe("runQuizAttempts", () => {
  it("keeps questionCount questions from the candidate pool on the first attempt, with no feedback", async () => {
    const model = fakeModel(call(balancedInput()));
    const result = await runQuizAttempts(model.callModel);

    expect(result.kind).toBe("quiz");
    if (result.kind === "quiz") expect(result.questions).toHaveLength(quiz.questionCount);
    expect(result.attempts).toBe(1);
    expect(model.feedback).toEqual([undefined]);
  });

  it("drops uneven candidates and keeps the balanced ones", async () => {
    const mixed = pool((n) => (n < 3 ? poolQuestion(n, [20, 30, 50, 30], 1) : poolQuestion(n, LENGTHS, 1)));
    const result = await runQuizAttempts(fakeModel(call(mixed)).callModel);

    expect(result.kind).toBe("quiz");
    if (result.kind === "quiz") {
      expect(result.questions.map((q) => q.question)).toEqual(["Question 4?", "Question 5?", "Question 6?", "Question 7?", "Question 8?"]);
    }
  });

  it("retries when selectBalanced finds no balanced subset, with the unbalanced feedback", async () => {
    const model = fakeModel(call(biasedInput()), call(balancedInput()));
    const result = await runQuizAttempts(model.callModel);

    expect(result.kind).toBe("quiz");
    expect(result.attempts).toBe(2);
    expect(model.feedback).toEqual([undefined, quizRetryFeedback.unbalanced]);
  });

  it("retries when too few candidates pass the ratio rule", async () => {
    const model = fakeModel(call(unevenInput()), call(balancedInput()));
    const result = await runQuizAttempts(model.callModel);

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

  it("treats a final-sized quiz as invalid, because the model is asked for the full candidate pool", async () => {
    const short = { status: "ok", questions: balancedInput().questions.slice(0, quiz.questionCount) };
    const result = await runQuizAttempts(fakeModel(call(short)).callModel);

    expect(result.kind).toBe("failed");
    if (result.kind === "failed") expect(result.failure).toBe("invalid");
  });

  it("fails when every attempt is unbalanced, and says the last failure was imbalance", async () => {
    const model = fakeModel(call(biasedInput()), call(biasedInput()));
    const result = await runQuizAttempts(model.callModel);

    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.failure).toBe("unbalanced");
      expect(result.inputShape).toBeUndefined();
    }
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

    expect(result).toMatchObject({ attempts: 2, inputTokens: 2100, outputTokens: 850 });
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

  it("describes the shape of invalid input (keys and types) in onRetry and in the final failure, never the values", async () => {
    const infos: { inputShape?: string; message: string }[] = [];
    const model = fakeModel(call(invalidInput()), call(invalidInput()));
    const result = await runQuizAttempts(model.callModel, { onRetry: (info) => infos.push(info) });

    const expected = "status: string, questions: string, secretNote: string";
    expect(infos).toHaveLength(1);
    expect(infos[0].inputShape).toBe(expected);
    expect(result.kind === "failed" && result.inputShape).toBe(expected);
    expect(JSON.stringify([infos, result])).not.toContain("do not log this");
    expect(JSON.stringify([infos, result])).not.toContain("not an array");
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
