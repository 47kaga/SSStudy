import { formatDuration } from "@/lib/time";
import type { RecentSession } from "@/lib/sessions";

const cell = "truncate border-b-hairline border-r-hairline border-ink px-2 py-2 md:px-4";
const head = `${cell} text-label uppercase`;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RecentSessions({ sessions }: { sessions: RecentSession[] }) {
  return (
    <div className="grid grid-cols-3 border-l-hairline border-t-hairline border-ink">
      <div className={head}>Project</div>
      <div className={head}>Date</div>
      <div className={`${head} text-right`}>Time</div>
      {sessions.map((session) => (
        <div key={session.id} className="contents">
          <div className={cell}>{session.projectTitle}</div>
          <div className={cell}>{formatDate(session.startedAtMs)}</div>
          <div className={`${cell} text-right tabular-nums`}>{formatDuration(session.durationSeconds)}</div>
        </div>
      ))}
    </div>
  );
}
