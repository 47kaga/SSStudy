"use client";

import { useActionState } from "react";
import { devGrantAction, pullAction, type PullState } from "@/app/actions";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { Panel } from "@/components/Panel";
import { Pips } from "@/components/Pips";

const initialState: PullState = { error: null };

// Full class names so Tailwind can see them.
const BORDER = { hairline: "border-hairline", medium: "border-medium", heavy: "border-heavy" } as const;

type PullPanelProps = {
  balance: number;
  pullCost: number;
  /** Whether the development-only grant is offered. Decided on the server. */
  devTools: boolean;
  devGrantShards: number;
};

// Shards and Pull on one row, the last pull below it. The browser never chooses an item or an amount:
// the pull action takes no input, and what is shown about the result was chosen on the server.
export function PullPanel({ balance, pullCost, devTools, devGrantShards }: PullPanelProps) {
  const [state, pull, pending] = useActionState(pullAction, initialState);
  const won = state.result;
  const accent = won?.accent ?? false;
  const affordable = Math.floor(balance / pullCost);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 border-l-hairline border-t-hairline border-ink">
        <Panel title="Shards">
          <div className="flex flex-col gap-1">
            <p className="text-title tabular-nums">{balance}</p>
            <p className="text-caption tabular-nums">
              = {affordable} {affordable === 1 ? "pull" : "pulls"}
            </p>
          </div>
          {devTools ? (
            <form action={devGrantAction}>
              <Button type="submit" size="small" className="border-dashed">
                Dev: +{devGrantShards} shards
              </Button>
            </form>
          ) : null}
        </Panel>

        <Panel title="Pull">
          <form action={pull} className="flex flex-col gap-4">
            <div>
              <Button type="submit" variant="primary" disabled={balance < pullCost || pending}>
                Pull ({pullCost})
              </Button>
            </div>
            {state.error ? <Notice>{state.error}</Notice> : null}
          </form>
        </Panel>
      </div>

      <div className="border-l-hairline border-t-hairline border-ink">
        <section
          className={`flex flex-col gap-4 border-b-hairline border-r-hairline border-ink p-6 md:p-8 ${
            accent ? "bg-accent text-background" : ""
          }`}
        >
          <h2 className="text-label uppercase">Last pull</h2>
          {won ? (
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
              <div
                className={`h-24 w-24 shrink-0 border-ink bg-background md:h-32 md:w-32 ${BORDER[won.border]}`}
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col gap-2">
                <p className="break-words text-title">{won.name}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Pips count={won.pips} tone={accent ? "background" : "ink"} />
                  <span className="text-label uppercase">{won.rarityLabel}</span>
                </div>
                {won.isNew ? (
                  <p
                    className={`w-fit border-hairline px-2 py-1 text-label uppercase ${
                      accent ? "border-background" : "border-ink"
                    }`}
                  >
                    New
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-caption">No pull yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
