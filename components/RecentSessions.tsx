import Link from "next/link";
import { formatDuration } from "@/lib/time";
import type { SessionQuizState } from "@/lib/session-quiz-state";
import type { RecentSession } from "@/lib/sessions";

// Rows are flex, not an equal-width grid: the project name gives way first, so the time and the quiz
// state keep their full width at phone width. The date is hidden below the md breakpoint for the same reason.
const cell = "border-b-hairline border-r-hairline border-ink px-2 py-2 md:px-4";
const project = `${cell} min-w-0 flex-1 truncate`;
const date = `${cell} hidden w-32 shrink-0 truncate md:block`;
const time = `${cell} w-24 shrink-0 text-right tabular-nums`;
const state = `${cell} w-24 shrink-0 whitespace-nowrap text-right`;
const head = "text-label uppercase";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// The state is worked out on the server; this only draws it.
function QuizCell({ sessionId, state }: { sessionId: number; state: SessionQuizState }) {
  const href = `/quiz/${sessionId}`;
  switch (state.kind) {
    case "too-short":
      return <span className="text-label uppercase">Too short</span>;
    case "quiz":
      return (
        <Link href={href} className="text-label uppercase underline">
          Quiz
        </Link>
      );
    case "resume":
      return (
        <Link href={href} className="text-label uppercase underline">
          Resume
        </Link>
      );
    case "graded":
      return (
        <span className="text-label tabular-nums">
          {state.shards === 0 ? "0 shards" : `+${state.shards} ${state.shards === 1 ? "shard" : "shards"}`}
        </span>
      );
  }
}

export function RecentSessions({ sessions }: { sessions: RecentSession[] }) {
  return (
    <div className="border-l-hairline border-t-hairline border-ink">
      <div className="flex">
        <div className={`${project} ${head}`}>Project</div>
        <div className={`${date} ${head}`}>Date</div>
        <div className={`${time} ${head}`}>Time</div>
        <div className={`${state} ${head}`}>Quiz</div>
      </div>
      {sessions.map((session) => (
        <div key={session.id} className="flex">
          <div className={project}>{session.projectTitle}</div>
          <div className={date}>{formatDate(session.startedAtMs)}</div>
          <div className={time}>{formatDuration(session.durationSeconds)}</div>
          <div className={state}>
            <QuizCell sessionId={session.id} state={session.quiz} />
          </div>
        </div>
      ))}
    </div>
  );
}
