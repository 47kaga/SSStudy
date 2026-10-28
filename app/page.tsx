import { connection } from "next/server";
import { archiveProjectAction } from "@/app/actions";
import { Button } from "@/components/Button";
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
                  className="flex items-center gap-2 border-b-hairline border-ink py-2 first:border-t-hairline md:gap-4"
                >
                  <span className="min-w-0 flex-1 truncate">{project.title}</span>
                  <span className="shrink-0 tabular-nums">{formatDuration(project.totalSeconds)}</span>
                  <form action={archiveProjectAction.bind(null, project.id)} className="shrink-0">
                    <Button
                      type="submit"
                      size="small"
                      aria-label={`Archive ${project.title}`}
                      disabled={running?.projectId === project.id}
                    >
                      Archive
                    </Button>
                  </form>
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
