"use client";

import { useState, useSyncExternalStore } from "react";
import { devAddMinutesAction } from "@/app/actions";
import { Button } from "@/components/Button";
import { devTimerMinutes } from "@/data/dev";
import { elapsedSeconds, formatDuration } from "@/lib/time";

type RunningTimerProps = {
  projectTitle: string;
  /** Server timestamp (ms) of when the session started. */
  startedAtMs: number;
  /** Server clock (ms) when the page was rendered, used to correct client clock skew. */
  serverNowMs: number;
  /** Whether the development-only add-minutes buttons are offered. Decided on the server. */
  devTools: boolean;
  /** The stop action and its pending flag are owned by TimerPanel, which stays mounted after the stop. */
  stopAction: () => void;
  stopping: boolean;
};

const TICK_MS = 250;
const PLACEHOLDER = "-:--:--";

// The store only reports the current time. Elapsed time is always computed from startedAtMs,
// so a sleeping tab or a refresh can never lose or inflate time.
function subscribe(onChange: () => void) {
  const interval = setInterval(onChange, TICK_MS);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    clearInterval(interval);
    document.removeEventListener("visibilitychange", onChange);
  };
}

function getClientNow(): number {
  return Math.floor(Date.now() / TICK_MS) * TICK_MS;
}

// Server render and hydration see null, so markup matches; the real value appears after mount.
function getServerNow(): null {
  return null;
}

export function RunningTimer({ projectTitle, startedAtMs, serverNowMs, devTools, stopAction, stopping }: RunningTimerProps) {
  const [skewMs] = useState(() => serverNowMs - Date.now());
  const clientNow = useSyncExternalStore(subscribe, getClientNow, getServerNow);

  const display = clientNow === null ? PLACEHOLDER : formatDuration(elapsedSeconds(startedAtMs, clientNow + skewMs));

  return (
    <div className="flex flex-col gap-4">
      <p className="truncate text-body">{projectTitle}</p>
      <p className="text-title tabular-nums" aria-live="off">
        {display}
      </p>
      <form action={stopAction}>
        <Button type="submit" variant="primary" disabled={stopping}>
          Stop
        </Button>
      </form>
      {devTools ? (
        <div className="flex flex-wrap gap-2">
          {devTimerMinutes.map((minutes) => (
            <form key={minutes} action={devAddMinutesAction.bind(null, minutes)}>
              <Button type="submit" size="small" className="border-dashed">
                +{minutes} min
              </Button>
            </form>
          ))}
        </div>
      ) : null}
    </div>
  );
}
