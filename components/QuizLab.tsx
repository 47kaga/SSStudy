"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { TextAreaField } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { Panel } from "@/components/Panel";
import { calculateShards } from "@/lib/economy";
import { longestOptionGuessScore } from "@/lib/quiz/balance";
import type { GradeResult, PublicQuestion } from "@/lib/quiz/types";

type Meta = {
  model: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  attempts: number;
};

// Lab-only preview: what this score would earn from a one-hour session.
const PREVIEW_SESSION_SECONDS = 3600;

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: response.ok, data };
  } catch {
    return { ok: false, data: { error: "Could not reach the server." } };
  }
}

function errorText(data: Record<string, unknown>): string {
  return typeof data.error === "string" ? data.error : "Something went wrong.";
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b-hairline border-r-hairline border-ink p-2">
      <span className="text-label uppercase">{label}</span>
      <span className="truncate tabular-nums">{value}</span>
    </div>
  );
}

// Limits come in as props so the client bundle never imports the prompt in data/quiz.ts.
export function QuizLab({ minChars, maxChars }: { minChars: number; maxChars: number }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizId, setQuizId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [grade, setGrade] = useState<GradeResult | null>(null);

  const length = text.trim().length;
  const hasQuiz = quizId !== null;
  const allAnswered = hasQuiz && answers.every((answer) => answer !== null);

  async function generate() {
    setBusy(true);
    setError(null);
    const { ok, data } = await postJson("/api/quiz/generate", { text });
    setBusy(false);

    if (!ok) {
      setError(errorText(data));
      return;
    }
    const nextQuestions = data.quiz as PublicQuestion[];
    setQuizId(data.quizId as number);
    setQuestions(nextQuestions);
    setMeta(data.meta as Meta);
    setAnswers(nextQuestions.map(() => null));
    setGrade(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const { ok, data } = await postJson("/api/quiz/grade", { quizId, answers });
    setBusy(false);

    if (!ok) {
      setError(errorText(data));
      return;
    }
    setGrade(data as unknown as GradeResult);
  }

  function choose(questionIndex: number, optionIndex: number) {
    setAnswers((current) => current.map((answer, index) => (index === questionIndex ? optionIndex : answer)));
  }

  const shardPreview = grade
    ? calculateShards({
        durationSeconds: PREVIEW_SESSION_SECONDS,
        correctAnswers: grade.correctAnswers,
        totalQuestions: grade.totalQuestions,
      })
    : null;

  // Measurement only: how a student who always picks the longest option would have done.
  // The correct indices come from the grade response, so this is never computed before grading.
  const longestGuess = grade
    ? longestOptionGuessScore(
        questions.map((question, index) => ({ ...question, correctIndex: grade.results[index].correctIndex })),
      )
    : null;

  return (
    <div className="grid grid-cols-1 border-l-hairline border-t-hairline border-ink md:grid-cols-2">
      <Panel title="Material">
        <TextAreaField
          label="Pasted text"
          rows={14}
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={busy}
        />
        <p className="tabular-nums text-caption">
          {length} / {maxChars} (min {minChars})
        </p>
        <div>
          <Button variant={hasQuiz ? "secondary" : "primary"} onClick={generate} disabled={busy || length === 0}>
            {busy && !hasQuiz ? "Working" : "Generate"}
          </Button>
        </div>
        {error ? <Notice>{error}</Notice> : null}
      </Panel>

      <Panel title="Quiz">
        {meta ? (
          <div className="grid grid-cols-2 border-l-hairline border-t-hairline border-ink md:grid-cols-5">
            <MetaCell label="Model" value={meta.model} />
            <MetaCell label="Latency" value={`${meta.latencyMs} ms`} />
            <MetaCell label="Input tokens" value={String(meta.inputTokens ?? "n/a")} />
            <MetaCell label="Output tokens" value={String(meta.outputTokens ?? "n/a")} />
            <MetaCell label="Attempts" value={String(meta.attempts)} />
          </div>
        ) : null}

        {questions.map((question, questionIndex) => {
          const result = grade?.results[questionIndex];
          return (
            <fieldset key={questionIndex} className="flex flex-col gap-2 border-hairline border-ink p-4">
              <legend className="px-1 text-label uppercase">Question {questionIndex + 1}</legend>
              <p>{question.question}</p>

              {result ? (
                <div className="flex flex-col gap-2">
                  <p className="text-caption">Your answer: {question.options[result.chosenIndex]}</p>
                  <p className="text-caption">Correct answer: {question.options[result.correctIndex]}</p>
                  <p
                    className={`w-fit border-hairline border-ink px-2 py-1 text-label uppercase ${
                      result.correct ? "bg-accent text-background" : "bg-background text-ink"
                    }`}
                  >
                    {result.correct ? "Correct" : "Wrong"}
                  </p>
                </div>
              ) : (
                question.options.map((option, optionIndex) => {
                  const selected = answers[questionIndex] === optionIndex;
                  return (
                    <label
                      key={optionIndex}
                      className={`flex cursor-pointer items-start gap-2 border-ink p-2 ${
                        selected ? "border-heavy" : "border-hairline"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${questionIndex}`}
                        className="mt-1 accent-accent"
                        checked={selected}
                        disabled={busy}
                        onChange={() => choose(questionIndex, optionIndex)}
                      />
                      <span>{option}</span>
                    </label>
                  );
                })
              )}
            </fieldset>
          );
        })}

        {hasQuiz && !grade ? (
          <div>
            <Button variant="primary" onClick={submit} disabled={!allAnswered || busy}>
              Submit
            </Button>
          </div>
        ) : null}

        {grade && shardPreview !== null ? (
          <div className="flex flex-col gap-2 border-t-heavy border-ink pt-4">
            <p className="text-title tabular-nums">
              {grade.correctAnswers} / {grade.totalQuestions}
            </p>
            <p className="text-caption">
              60 min session at this score: {shardPreview} {shardPreview === 1 ? "shard" : "shards"}
            </p>
            <p className="text-caption tabular-nums">
              Longest-option guess would have scored {longestGuess} / {grade.totalQuestions}
            </p>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
