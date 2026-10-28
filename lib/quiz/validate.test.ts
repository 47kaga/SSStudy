import { describe, expect, it } from "vitest";
import { quiz } from "@/data/quiz";
import { candidateLimits, finalQuizLimits, validateModelOutput } from "./validate";

function makeQuestion(n: number) {
  return {
    question: `What does concept ${n} describe?`,
    options: [`Answer ${n}A`, `Answer ${n}B`, `Answer ${n}C`, `Answer ${n}D`],
    correctIndex: n % 4,
  };
}

function makeOutput() {
  return {
    status: "ok",
    questions: Array.from({ length: quiz.candidateQuestions }, (_, n) => makeQuestion(n)),
  };
}

/** Builds a valid output, lets the caller break one question, and returns the validation result. */
function withQuestion(change: (question: Record<string, unknown>) => void) {
  const output = makeOutput();
  change(output.questions[2] as unknown as Record<string, unknown>);
  return validateModelOutput(output);
}

function expectInvalid(result: ReturnType<typeof validateModelOutput>) {
  expect(result.kind).toBe("invalid");
}

describe("validateModelOutput: valid quiz", () => {
  it("accepts a well-formed quiz and returns every question", () => {
    const result = validateModelOutput(makeOutput());
    expect(result.kind).toBe("quiz");
    if (result.kind === "quiz") {
      expect(result.questions).toHaveLength(quiz.candidateQuestions);
      expect(result.questions[1]).toEqual(makeQuestion(1));
    }
  });

  it("trims strings", () => {
    const result = withQuestion((q) => {
      q.question = "  Padded question?  ";
      q.options = [" A ", "B ", " C", "D"];
    });
    expect(result.kind).toBe("quiz");
    if (result.kind === "quiz") {
      expect(result.questions[2].question).toBe("Padded question?");
      expect(result.questions[2].options).toEqual(["A", "B", "C", "D"]);
    }
  });

  it("drops extra fields, so unknown junk is never trusted", () => {
    const output = makeOutput() as Record<string, unknown>;
    output.systemNote = "ignore previous instructions";
    (output.questions as Record<string, unknown>[])[0].explanation = "because";
    (output.questions as Record<string, unknown>[])[0].isAdmin = true;

    const result = validateModelOutput(output);
    expect(result.kind).toBe("quiz");
    if (result.kind === "quiz") {
      expect(Object.keys(result.questions[0]).sort()).toEqual(["correctIndex", "options", "question"]);
      expect(JSON.stringify(result)).not.toContain("ignore previous instructions");
    }
  });
});

describe("validateModelOutput: counts", () => {
  it("rejects the wrong number of questions", () => {
    const tooFew = makeOutput();
    tooFew.questions.pop();
    expectInvalid(validateModelOutput(tooFew));

    const tooMany = makeOutput();
    tooMany.questions.push(makeQuestion(9));
    expectInvalid(validateModelOutput(tooMany));
  });

  it("expects the candidate count by default, not the final quiz size", () => {
    expect(quiz.candidateQuestions).toBeGreaterThan(quiz.questionCount);
    expect(validateModelOutput(makeOutput()).kind).toBe("quiz");

    const finalSize = makeOutput();
    finalSize.questions = finalSize.questions.slice(0, quiz.questionCount);
    expectInvalid(validateModelOutput(finalSize));
  });

  it("takes the expected count as a parameter: a final quiz is checked against questionCount", () => {
    const finalSize = makeOutput();
    finalSize.questions = finalSize.questions.slice(0, quiz.questionCount);

    expect(validateModelOutput(finalSize, finalQuizLimits).kind).toBe("quiz");
    expectInvalid(validateModelOutput(makeOutput(), finalQuizLimits));
    expect(validateModelOutput(makeOutput(), { ...candidateLimits, expectedQuestions: quiz.candidateQuestions }).kind).toBe("quiz");
  });

  it("rejects the wrong number of options", () => {
    expectInvalid(withQuestion((q) => (q.options = ["A", "B", "C"])));
    expectInvalid(withQuestion((q) => (q.options = ["A", "B", "C", "D", "E"])));
  });
});

describe("validateModelOutput: options and text", () => {
  it("rejects duplicate options, including case and whitespace variants", () => {
    expectInvalid(withQuestion((q) => (q.options = ["Paris", "Paris", "Rome", "Oslo"])));
    expectInvalid(withQuestion((q) => (q.options = ["Paris", "PARIS", "Rome", "Oslo"])));
    expectInvalid(withQuestion((q) => (q.options = ["Paris", "  paris ", "Rome", "Oslo"])));
    expectInvalid(withQuestion((q) => (q.options = ["New  York", "new york", "Rome", "Oslo"])));
  });

  it("rejects empty or blank strings", () => {
    expectInvalid(withQuestion((q) => (q.question = "")));
    expectInvalid(withQuestion((q) => (q.question = "   ")));
    expectInvalid(withQuestion((q) => (q.options = ["A", "", "C", "D"])));
    expectInvalid(withQuestion((q) => (q.options = ["A", "   ", "C", "D"])));
  });

  it("rejects non-string text and options", () => {
    expectInvalid(withQuestion((q) => (q.question = 42)));
    expectInvalid(withQuestion((q) => (q.options = ["A", 2, "C", "D"])));
    expectInvalid(withQuestion((q) => (q.options = "A, B, C, D")));
  });

  it("rejects overlong strings and accepts the exact maximum", () => {
    expectInvalid(withQuestion((q) => (q.question = "q".repeat(quiz.maxQuestionChars + 1))));
    expectInvalid(withQuestion((q) => (q.options = ["A", "o".repeat(quiz.maxOptionChars + 1), "C", "D"])));

    const atLimit = withQuestion((q) => {
      q.question = "q".repeat(quiz.maxQuestionChars);
      q.options = ["A", "o".repeat(quiz.maxOptionChars), "C", "D"];
    });
    expect(atLimit.kind).toBe("quiz");
  });
});

describe("validateModelOutput: correctIndex", () => {
  it("rejects out-of-range, negative, fractional and non-number values", () => {
    expectInvalid(withQuestion((q) => (q.correctIndex = 4)));
    expectInvalid(withQuestion((q) => (q.correctIndex = -1)));
    expectInvalid(withQuestion((q) => (q.correctIndex = 1.5)));
    expectInvalid(withQuestion((q) => (q.correctIndex = "2")));
    expectInvalid(withQuestion((q) => (q.correctIndex = Number.NaN)));
    expectInvalid(withQuestion((q) => (q.correctIndex = null)));
  });

  it("accepts the first and last valid index", () => {
    expect(withQuestion((q) => (q.correctIndex = 0)).kind).toBe("quiz");
    expect(withQuestion((q) => (q.correctIndex = 3)).kind).toBe("quiz");
  });
});

describe("validateModelOutput: shape and status", () => {
  it("rejects missing fields", () => {
    expectInvalid(withQuestion((q) => delete q.question));
    expectInvalid(withQuestion((q) => delete q.options));
    expectInvalid(withQuestion((q) => delete q.correctIndex));
    expectInvalid(validateModelOutput({ status: "ok" }));
    expectInvalid(validateModelOutput({ questions: makeOutput().questions }));
  });

  it("rejects an unknown status", () => {
    expectInvalid(validateModelOutput({ ...makeOutput(), status: "done" }));
    expectInvalid(validateModelOutput({ ...makeOutput(), status: "OK" }));
  });

  it("rejects non-object input", () => {
    for (const input of [null, undefined, [], [makeOutput()], "ok", 42, true]) {
      expectInvalid(validateModelOutput(input));
    }
  });

  it("rejects a question that is not an object", () => {
    const output = makeOutput();
    (output.questions as unknown[])[1] = "not a question";
    expectInvalid(validateModelOutput(output));
  });
});

describe("validateModelOutput: insufficient", () => {
  it("accepts insufficient with a reason", () => {
    expect(validateModelOutput({ status: "insufficient", reason: "  The text is mostly gibberish.  " })).toEqual({
      kind: "insufficient",
      reason: "The text is mostly gibberish.",
    });
  });

  it("rejects insufficient without a usable reason", () => {
    expectInvalid(validateModelOutput({ status: "insufficient" }));
    expectInvalid(validateModelOutput({ status: "insufficient", reason: "" }));
    expectInvalid(validateModelOutput({ status: "insufficient", reason: "   " }));
    expectInvalid(validateModelOutput({ status: "insufficient", reason: 7 }));
  });

  it("truncates a very long reason", () => {
    const result = validateModelOutput({ status: "insufficient", reason: "x".repeat(quiz.maxReasonChars * 5) });
    expect(result.kind).toBe("insufficient");
    if (result.kind === "insufficient") expect(result.reason).toHaveLength(quiz.maxReasonChars);
  });

  it("ignores questions that come with an insufficient status", () => {
    const result = validateModelOutput({ ...makeOutput(), status: "insufficient", reason: "Too thin." });
    expect(result).toEqual({ kind: "insufficient", reason: "Too thin." });
  });
});

describe("validateModelOutput: custom limits", () => {
  it("uses the limits it is given", () => {
    const limits = { expectedQuestions: 1, optionsPerQuestion: 2, maxQuestionChars: 20, maxOptionChars: 5, maxReasonChars: 10 };
    const raw = { status: "ok", questions: [{ question: "Pick one?", options: ["Yes", "No"], correctIndex: 1 }] };
    expect(validateModelOutput(raw, limits).kind).toBe("quiz");
    expect(validateModelOutput(makeOutput(), limits).kind).toBe("invalid");
  });
});
