"use client";

import { useActionState, useState } from "react";
import { startTimerAction, stopTimerAction, type StartState, type StopState } from "@/app/actions";
import { Button } from "@/components/Button";
import { SelectField } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { QuizPrompt } from "@/components/QuizPrompt";
import { RunningTimer } from "@/components/RunningTimer";
import type { RunningSession } from "@/lib/sessions";

const initialState: StartState = { error: null };
const initialStopState: StopState = { stopped: null };

type TimerPanelProps = {
  projects: { id: number; title: string }[];
  running: RunningSession | null;
  devTools: boolean;
  /** Stopping a session at least this long opens the quiz dialog. Passed in so the client never imports the quiz prompt data. */
  quizPromptMinSeconds: number;
};

// Owns the start and stop action state. This component stays mounted when the page refreshes after a stop,
// while RunningTimer unmounts, so the stop result (and the quiz dialog it opens) must live here.
// A "timer already running" refusal stays visible for the same reason.
export function TimerPanel({ projects, running, devTools, quizPromptMinSeconds }: TimerPanelProps) {
  const [state, action, pending] = useActionState(startTimerAction, initialState);
  const [stopState, stopAction, stopping] = useActionState(stopTimerAction, initialStopState);
  // The result object itself is remembered once dismissed, so the next stop (a new object) opens it again.
  const [dismissed, setDismissed] = useState<StopState | null>(null);

  const stopped = stopState.stopped;
  const prompt =
    stopped && stopped.durationSeconds >= quizPromptMinSeconds && dismissed !== stopState ? stopped : null;
  const dialog = prompt ? <QuizPrompt summary={prompt} onClose={() => setDismissed(stopState)} /> : null;

  const empty = projects.length === 0;
  const formError = state.code === "already-running" ? null : state.error;

  // The dialog is a sibling at a fixed position, so it is not remounted when the running timer swaps for
  // the start form after the stop, and it is outside the start form.
  return (
    <>
      {running ? (
        <div className="flex flex-col gap-4">
          {state.code === "already-running" && state.error ? <Notice>{state.error}</Notice> : null}
          <RunningTimer
            key={running.id}
            projectTitle={running.projectTitle}
            startedAtMs={running.startedAtMs}
            serverNowMs={running.serverNowMs}
            devTools={devTools}
            stopAction={stopAction}
            stopping={stopping}
          />
        </div>
      ) : (
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
      )}
      {dialog}
    </>
  );
}