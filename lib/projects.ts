import "server-only";
import { db } from "@/lib/db";

export type ProjectSummary = {
  id: number;
  title: string;
  totalSeconds: number;
};

export async function listProjects(): Promise<ProjectSummary[]> {
  const [projects, totals] = await Promise.all([
    db.project.findMany({ orderBy: { createdAt: "asc" } }),
    db.studySession.groupBy({
      by: ["projectId"],
      where: { endedAt: { not: null } },
      _sum: { durationSeconds: true },
    }),
  ]);

  const totalByProject = new Map(totals.map((row) => [row.projectId, row._sum.durationSeconds ?? 0]));
  return projects.map(({ id, title }) => ({ id, title, totalSeconds: totalByProject.get(id) ?? 0 }));
}

export async function createProject(title: string): Promise<void> {
  await db.project.create({ data: { title } });
}
