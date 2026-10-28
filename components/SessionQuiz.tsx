"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/Button";
import { TextAreaField } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { Panel } from "@/components/Panel";
import { Row } from "@/components/Row";
import { economy } from "@/data/economy";
import type { AwardBreakdown, TimeLimit } from "@/lib/economy";
import type { GradeResult, PublicQuestion } from "@/lib/quiz/types";
import { formatDuration } from "@/lib/time";

// The browser sends only the pasted text and the chosen answers. Duration, material size and every shard
// amount are worked out on the server from stored rows, and shown here as read back.

type Start =
  | { kind: "paste" }
  | { kind: "quiz"; quizId: number; questions: PublicQuestion[] }
  | {
      kind: "graded";
      durationSeconds: number;
      countedSeconds: number;
      limitedBy: TimeLimit;
      correctAnswers: number;
      totalQuestions: number;
      rawShards: number;
      awarded: number;
      cappedByDaily: boolean;
    };

type Props = {
  sessionId: number;
  minChars: number;
  maxChars: number;
  start: Start;
};

type Graded = GradeResult & { award: AwardBreakdown | null; balance: number };

const SECONDS_PER_MINUTE = 60;

const LIMIT_LABEL: Record<TimeLimit, string> = {
  duration: "Session length",
  "session-cap": `${economy.maxCountedSecondsPerSession / 3600}-hour cap`,
  material: "Material length",
};

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

type ResultRows = {
  durationSeconds: number;
  countedSeconds: number;
  limitedBy: TimeLimit;
  correctAnswers: number;
  totalQuestions: number;
  rawShards: number;
  awarded: number;
  /** Only known while the grade response is on screen. */
  dailyRemaining: number | null;
  balance: number | null;
  cappedByDaily: boolean;
};

function Breakdown({ rows }: { rows: ResultRows }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 border-l-hairline border-t-hairline border-ink">
        <Row label="Time studied" value={formatDuration(rows.durationSeconds)} />
        <Row label="Time counted" value={formatDuration(rows.countedSeconds)} />
        <Row label="Limited by" value={LIMIT_LABEL[rows.limitedBy]} />
        <Row label="Score" value={`${rows.correctAnswers} / ${rows.totalQuestions}`} />
        <Row label="Shards before daily cap" value={String(rows.rawShards)} />
        {rows.dailyRemaining !== null ? <Row label="Daily cap remaining" value={String(rows.dailyRemaining)} /> : null}
        <Row label="Shards awarded" value={rows.cappedByDaily ? `${rows.awarded} (capped)` : String(rows.awarded)} />
        {rows.balance !== null ? <Row label="New balance" value={String(rows.balance)} /> : null}
      </div>
      <div>
        <Link href="/collection" className="text-label uppercase underline">
          Collection
        </Link>
      </div>
    </div>
  );
}

export function SessionQuiz({ sessionId, minChars, maxChars, start }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizId, setQuizId] = useState<number | null>(start.kind === "quiz" ? start.quizId : null);
  const [questions, setQuestions] = useState<PublicQuestion[]>(start.kind === "quiz" ? start.questions : []);
  const [answers, setAnswers] = useState<(number | null)[]>(
    start.kind === "quiz" ? start.questions.map(() => null) : [],
  );
  const [grade, setGrade] = useState<Graded | null>(null);

  const length = text.trim().length;
  const countedMinutes = Math.floor((length * economy.secondsPerSourceChar) / SECONDS_PER_MINUTE);
  const allAnswered = answers.length > 0 && answers.every((answer) => answer !== null);

  async function generate() {
    setBusy(true);
    setError(null);
    const { ok, data } = await postJson("/api/quiz/generate", { sessionId, text });
    setBusy(false);
    if (!ok) {
      setError(errorText(data));
      return;
    }
    const nextQuestions = data.quiz as PublicQuestion[];
    setQuizId(data.quizId as number);
    setQuestions(nextQuestions);
    setAnswers(nextQuestions.map(() => null));
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
    setGrade(data as unknown as Graded);
  }

  function choose(questionIndex: number, optionIndex: number) {
    setAnswers((current) => current.map((answer, index) => (index === questionIndex ? optionIndex : answer)));
  }

  // Already graded when the page loaded (a refresh): the stored breakdown, without per-question detail.
  if (start.kind === "graded" && !grade) {
    return (
      <div className="border-l-hairline border-t-hairline border-ink">
        <Panel title="Result">
          <Breakdown rows={{ ...start, dailyRemaining: null, balance: null }} />
        </Panel>
      </div>
    );
  }

  if (grade) {
    const award = grade.award;
    return (
      <div className="flex flex-col gap-6">
        <div className="border-l-hairline border-t-hairline border-ink">
          <Panel title="Result">
            {award ? (
              <Breakdown rows={{ ...award, dailyRemaining: award.dailyRemaining, balance: grade.balance }} />
            ) : (
              <p className="tabular-nums">
                {grade.correctAnswers} / {grade.totalQuestions}
              </p>
            )}
          </Panel>
        </div>
        <div className="flex flex-col gap-4">
          {questions.map((question, index) => {
            const result = grade.results[index];
            return (
              <div key={index} className="flex flex-col gap-2 border-hairline border-ink p-4">
                <p className="text-label uppercase">Question {index + 1}</p>
                <p>{question.question}</p>
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
            );
          })}
        </div>
      </div>
    );
  }

  if (quizId === null) {
    return (
      <div className="border-l-hairline border-t-hairline border-ink">
        <Panel title="Material">
          <TextAreaField
            label="Pasted text"
            rows={14}
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={busy}
          />
          <div className="flex flex-col gap-1">
            <p className="text-caption tabular-nums">
              {length} / {maxChars} (min {minChars})
            </p>
            <p className="text-caption tabular-nums">
              Counts up to {countedMinutes} {countedMinutes === 1 ? "minute" : "minutes"} of this session
            </p>
          </div>
          <div>
            <Button variant="primary" onClick={generate} disabled={busy || length === 0}>
              {busy ? "Generating, up to 30 seconds" : "Generate"}
            </Button>
          </div>
          {error ? <Notice>{error}</Notice> : null}
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {questions.map((question, questionIndex) => (
        <fieldset key={questionIndex} className="flex flex-col gap-2 border-hairline border-ink p-4">
          <legend className="px-1 text-label uppercase">Question {questionIndex + 1}</legend>
          <p>{question.question}</p>
          {question.options.map((option, optionIndex) => {
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
          })}
        </fieldset>
      ))}
      <div>
        <Button variant="primary" onClick={submit} disabled={!allAnswered || busy}>
          Submit
        </Button>
      </div>
      {error ? <Notice>{error}</Notice> : null}
    </div>
  );
}
