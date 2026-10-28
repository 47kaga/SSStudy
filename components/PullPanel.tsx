"use client";

import { useActionState } from "react";
import { devGrantAction, pullAction, type PullState } from "@/app/actions";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { Panel } from "@/components/Panel";
import { gacha, gachaData } from "@/data/gacha";

const initialState: PullState = { error: null };

type PullPanelProps = {
  balance: number;
  /** Whether the development-only grant is offered. Decided on the server. */
  devTools: boolean;
};

// The top row of the collection page. The browser never chooses an item or an amount: the pull action
// takes no input, and the grant amount is fixed on the server.
export function PullPanel({ balance, devTools }: PullPanelProps) {
  const [state, pull, pending] = useActionState(pullAction, initialState);
  const won = state.result ? gachaData.items.find((item) => item.key === state.result?.itemKey) : undefined;
  const rarity = won ? gachaData.rarities.find((entry) => entry.id === won.rarity) : undefined;

  return (
    <div className="grid grid-cols-1 border-l-hairline border-t-hairline border-ink md:grid-cols-3">
      <Panel title="Shards">
        <p className="text-title tabular-nums">{balance}</p>
        {devTools ? (
          <form action={devGrantAction}>
            <Button type="submit" size="small">
              Dev: +{gacha.devGrantShards} shards
            </Button>
          </form>
        ) : null}
      </Panel>

      <Panel title="Pull">
        <form action={pull} className="flex flex-col gap-4">
          <div>
            <Button type="submit" variant="primary" disabled={balance < gacha.pullCost || pending}>
              Pull ({gacha.pullCost} shards)
            </Button>
          </div>
          {state.error ? <Notice>{state.error}</Notice> : null}
        </form>
      </Panel>

      <Panel title="Last pull">
        {won && rarity ? (
          <div className="flex flex-col gap-1">
            <p className="text-body">{won.name}</p>
            <p className="text-caption">
              {rarity.label}
              {state.result?.isNew ? " / New" : ""}
            </p>
          </div>
        ) : (
          <p className="text-caption">No pull yet.</p>
        )}
      </Panel>
    </div>
  );
}
