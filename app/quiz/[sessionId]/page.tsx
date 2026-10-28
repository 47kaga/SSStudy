import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Divider } from "@/components/Divider";
import { Screen } from "@/components/Screen";
import { SessionQuiz } from "@/components/SessionQuiz";
import { quiz } from "@/data/quiz";
import { quizLabEnabled } from "@/lib/quiz/http";
import { getQuizPageState } from "@/lib/quiz/session-page";

const LINES = {
  "not-found": "Session not found.",
  running: "This session is still running.",
  "too-short": "This session was too short to unlock a quiz.",
  unavailable: "This quiz is unavailable.",
} as const;

export default async function QuizPage({ params }: { params: Promise<{ sessionId: string }> }) {
  // Per-request data, and gated like the quiz routes it calls: they stay off in production until auth exists.
  await connection();
  if (!quizLabEnabled()) notFound();

  const { sessionId: rawId } = await params;
  const sessionId = /^[1-9]\d{0,9}$/.test(rawId) ? Number(rawId) : null;
  const state = sessionId === null ? ({ kind: "not-found" } as const) : await getQuizPageState(sessionId);

  return (
    <Screen>
      <h1 className="text-title">Quiz</h1>
      <Divider weight="heavy" />
      {sessionId !== null && (state.kind === "paste" || state.kind === "quiz" || state.kind === "graded") ? (
        <SessionQuiz
          sessionId={sessionId}
          minChars={quiz.minSourceChars}
          maxChars={quiz.maxSourceChars}
          start={state}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <p>{LINES[state.kind as keyof typeof LINES]}</p>
          <div>
            <Link href="/" className="text-label uppercase underline">
              Study
            </Link>
          </div>
        </div>
      )}
    </Screen>
  );
}
