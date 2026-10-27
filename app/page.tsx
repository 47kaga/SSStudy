import { connection } from "next/server";
import { Divider } from "@/components/Divider";
import { Panel } from "@/components/Panel";
import { ProjectForm } from "@/components/ProjectForm";
import { RecentSessions } from "@/components/RecentSessions";
import { Screen } from "@/components/Screen";
import { TimerPanel } from "@/components/TimerPanel";
import { listProjects } from "@/lib/projects";
import { getRunningSession, listRecentSessions } from "@/lib/sessions";
import { formatDuration } from "@/lib/time";

export default async function StudyPage() {
  // Per-request data: never prerender this page at build time.
  await connection();

  const [projects, running, recent] = await Promise.all([listProjects(), getRunningSession(), listRecentSessions()]);
  return (
    <Screen>
      <h1 className="text-title">Study</h1>
      <Divider weight="heavy" />
      <div className="grid grid-cols-1 border-l-hairline border-t-hairline border-ink md:grid-cols-2">
        <Panel title="Timer">
          <TimerPanel projects={projects.map(({ id, title }) => ({ id, title }))} running={running} />
        </Panel>
        <Panel title="Projects">
          {projects.length > 0 ? (
            <ul className="flex flex-col">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-baseline justify-between gap-4 border-b-hairline border-ink py-2 first:border-t-hairline"
                >
                  <span className="truncate">{project.title}</span>
                  <span className="tabular-nums">{formatDuration(project.totalSeconds)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <ProjectForm />
        </Panel>
      </div>
      <h2 className="text-label uppercase">Recent sessions</h2>
      <RecentSessions sessions={recent} />
    </Screen>
  );
}
