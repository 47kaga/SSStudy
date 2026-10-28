import "server-only";
import { randomInt } from "node:crypto";
import { gacha, gachaData } from "@/data/gacha";
import { db } from "@/lib/db";
import { rollPull, validateGachaData, type GachaItem } from "@/lib/gacha";
import type { Prisma } from "@/generated/prisma/client";

// Fail at startup, not on someone's pull, if the game data is broken.
validateGachaData(gachaData);

export type PullResult =
  | { ok: true; item: GachaItem; isNew: boolean; balance: number }
  | { ok: false; reason: "insufficient-shards" };

/** The ledger is append-only, so the balance is always the sum of every row. */
export async function sumLedger(client: Prisma.TransactionClient): Promise<number> {
  const total = await client.shardLedger.aggregate({ _sum: { amount: true } });
  return total._sum.amount ?? 0;
}

export function getBalance(): Promise<number> {
  return sumLedger(db);
}

/** Development helpers (the grant button and action) are off in production builds. */
export function devToolsEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Appends the development-only grant. Returns false and writes nothing in production. */
export async function grantDevShards(): Promise<boolean> {
  if (!devToolsEnabled()) return false;
  await db.shardLedger.create({ data: { amount: gacha.devGrantShards, reason: "dev-grant" } });
  return true;
}

/**
 * Spends `pullCost` shards on one pull. The check, the ledger row and the inventory change happen in one
 * interactive transaction. The SQLite adapter holds a mutex and runs BEGIN on its single connection for
 * every transaction, so two pulls submitted at once run one after the other: the second sees the
 * first one's ledger row and is refused if the balance no longer covers it.
 */
export async function performPull(): Promise<PullResult> {
  return db.$transaction(async (tx): Promise<PullResult> => {
    const balance = await sumLedger(tx);
    if (balance < gacha.pullCost) return { ok: false, reason: "insufficient-shards" };

    const item = rollPull(gachaData, randomInt);
    await tx.shardLedger.create({ data: { amount: -gacha.pullCost, reason: `pull:${item.key}` } });

    const owned = await tx.inventoryItem.findUnique({ where: { itemKey: item.key } });
    await tx.inventoryItem.upsert({
      where: { itemKey: item.key },
      create: { itemKey: item.key, count: 1 },
      update: { count: { increment: 1 } },
    });

    return { ok: true, item, isNew: owned === null, balance: balance - gacha.pullCost };
  });
}
