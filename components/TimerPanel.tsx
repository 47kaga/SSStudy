"use client";

import { useActionState } from "react";
import { startTimerAction, type StartState } from "@/app/actions";
import { Button } from "@/components/Button";
import { SelectField } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { RunningTimer } from "@/components/RunningTimer";
import type { RunningSession } from "@/lib/sessions";

const initialState: StartState = { error: null };

type TimerPanelProps = {
  projects: { id: number; title: string }[];
  running: RunningSession | null;
};

// Owns the start action state so a "timer already running" refusal stays visible even though
// the page refresh swaps the start form for the running timer.
export function TimerPanel({ projects, running }: TimerPanelProps) {
  const [state, action, pending] = useActionState(startTimerAction, initialState);

  if (running) {
    return (
      <div className="flex flex-col gap-4">
        {state.code === "already-running" && state.error ? <Notice>{state.error}</Notice> : null}
        <RunningTimer
          key={running.id}
          projectTitle={running.projectTitle}
          startedAtMs={running.startedAtMs}
          serverNowMs={running.serverNowMs}
        />
      </div>
    );
  }

  const empty = projects.length === 0;
  const formError = state.code === "already-running" ? null : state.error;

  return (
    <form action={action} className="flex flex-col gap-4">
      <SelectField label="Project" name="projectId" disabled={empty} error={formError}>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.title}
          </option>
        ))}
      </SelectField>
      <div>
        <Button type="submit" variant="primary" disabled={empty || pending}>
          Start
        </Button>
      </div>
    </form>
  );
}
