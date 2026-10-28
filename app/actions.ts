"use server";

import { refresh } from "next/cache";
import { validateProjectTitle } from "@/lib/project-title";
import { archiveProject, createProject } from "@/lib/projects";
import { startSession, stopRunningSession } from "@/lib/sessions";
import { grantDevShards, performPull } from "@/lib/shards";

export type FormState = { error: string | null; value?: string };
export type StartState = { error: string | null; code?: "already-running" };
/** What the page may know about a pull: which item the server picked, and whether it was new. */
export type PullState = { error: string | null; result?: { itemKey: string; isNew: boolean } };

export async function createProjectAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const raw = formData.get("title");
  const result = validateProjectTitle(raw);
  if (!result.ok) return { error: result.message, value: typeof raw === "string" ? raw : "" };

  await createProject(result.title);
  refresh();
  return { error: null };
}

export async function startTimerAction(_previous: StartState, formData: FormData): Promise<StartState> {
  const raw = formData.get("projectId");
  const projectId = typeof raw === "string" && raw !== "" ? Number(raw) : Number.NaN;
  if (!Number.isInteger(projectId)) return { error: "Select a project." };

  const result = await startSession(projectId);
  // Refresh in every case so a stale page picks up the real state.
  refresh();
  if (result.ok) return { error: null };
  if (result.reason === "already-running") {
    return { error: "A timer is already running. Stop it first.", code: "already-running" };
  }
  return { error: "That project no longer exists." };
}

export async function archiveProjectAction(projectId: number): Promise<void> {
  // Actions are reachable by direct POST, so validate even though the UI binds a number.
  if (!Number.isInteger(projectId)) return;
  await archiveProject(projectId);
  refresh();
}

export async function stopTimerAction(): Promise<void> {
  await stopRunningSession();
  refresh();
}

// The client sends nothing: the server picks the item and the cost, and decides if the pull is allowed.
export async function pullAction(): Promise<PullState> {
  const result = await performPull();
  // Refresh in every case so a stale page picks up the real balance.
  refresh();
  if (!result.ok) return { error: "Not enough shards." };
  return { error: null, result: { itemKey: result.item.key, isNew: result.isNew } };
}

// Development only: does nothing in production. The amount is fixed in data/gacha.ts.
export async function devGrantAction(): Promise<void> {
  await grantDevShards();
  refresh();
}
