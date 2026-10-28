import "server-only";
import { db } from "@/lib/db";

export type OwnedItem = { itemKey: string; count: number };

export async function listInventory(): Promise<OwnedItem[]> {
  const rows = await db.inventoryItem.findMany({ select: { itemKey: true, count: true } });
  return rows;
}
