import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invitations, watchRelationships } from "@/app/db/schema";
import { db } from "@/lib/db";
import { hasEntitlement } from "@/lib/entitlement";
import { getWatcherFreeTierPairLimit } from "@/lib/env";
import { authenticate } from "../../_lib/auth";
import { newId } from "../../_lib/id";

/**
 * POST /api/v1/invitations/accept
 * 見守る側が招待コードを入力してペアリングを成立させる。
 */
export async function POST(request: Request) {
  const auth = await authenticate(request, { requireRole: "watcher" });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    code?: string;
  } | null;
  const code = body?.code?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "code_required" }, { status: 400 });
  }

  const now = new Date();
  const rows = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.code, code),
        gt(invitations.expiresAt, now),
        isNull(invitations.usedAt),
      ),
    )
    .limit(1);
  const inv = rows[0];
  if (!inv) {
    return NextResponse.json({ error: "invalid_or_expired" }, { status: 404 });
  }

  const watcherId = auth.user.id;

  // 無料枠チェック: サブスク未加入なら pair 上限を超えないか確認
  const subscribed = await hasEntitlement(watcherId);
  if (!subscribed) {
    const [countRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(watchRelationships)
      .where(
        and(
          eq(watchRelationships.watcherId, watcherId),
          eq(watchRelationships.status, "active"),
        ),
      );
    const current = countRow?.n ?? 0;
    // 同一 watched への再ペアリングは上限に含めない(既存カウントに含まれている)
    const alreadyPaired = await db
      .select()
      .from(watchRelationships)
      .where(
        and(
          eq(watchRelationships.watcherId, watcherId),
          eq(watchRelationships.watchedId, inv.watchedId),
        ),
      )
      .limit(1);
    if (
      alreadyPaired.length === 0 &&
      current >= getWatcherFreeTierPairLimit()
    ) {
      return NextResponse.json(
        {
          error: "subscription_required",
          message: `無料枠は${getWatcherFreeTierPairLimit()}人までです。追加にはサブスクリプションが必要です。`,
        },
        { status: 402 },
      );
    }
  }
  await db.transaction(async (tx) => {
    await tx
      .update(invitations)
      .set({ usedAt: now, usedBy: watcherId })
      .where(eq(invitations.id, inv.id));

    await tx
      .insert(watchRelationships)
      .values({
        id: newId(),
        watcherId,
        watchedId: inv.watchedId,
        status: "active",
      })
      .onConflictDoUpdate({
        target: [watchRelationships.watcherId, watchRelationships.watchedId],
        set: { status: "active" },
      });
  });

  return NextResponse.json({ watchedId: inv.watchedId, status: "active" });
}
