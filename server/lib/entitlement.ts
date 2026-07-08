import { and, eq } from "drizzle-orm";
import { subscriptions } from "@/app/db/schema";
import { db } from "./db";
import { WATCHER_PREMIUM_ENTITLEMENT } from "./env";

/**
 * ユーザーが指定エンタイトルメントで有効か判定する。
 * status が active / in_grace_period かつ expiresAt が未来(未設定=永続扱い)なら有効。
 */
export async function hasEntitlement(
  userId: string,
  entitlement: string = WATCHER_PREMIUM_ENTITLEMENT,
): Promise<boolean> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.entitlement, entitlement),
      ),
    )
    .limit(1);
  const s = rows[0];
  if (!s) return false;
  if (s.status !== "active" && s.status !== "in_grace_period") return false;
  if (s.expiresAt && s.expiresAt.getTime() < Date.now()) return false;
  return true;
}
