import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { messages, watchRelationships } from "@/app/db/schema";
import { db } from "@/lib/db";
import { authenticate } from "../../../_lib/auth";

/**
 * GET /api/v1/watched/:id/messages
 * 見守る側が、自分がその見守り対象に送ったメッセージの直近10件を取得する。
 * 既読状態(readAt)の確認用途。
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request, { requireRole: "watcher" });
  if (!auth.ok) return auth.response;

  const { id: watchedId } = await ctx.params;

  const rel = await db
    .select()
    .from(watchRelationships)
    .where(
      and(
        eq(watchRelationships.watcherId, auth.user.id),
        eq(watchRelationships.watchedId, watchedId),
        eq(watchRelationships.status, "active"),
      ),
    )
    .limit(1);
  if (rel.length === 0) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.watchedId, watchedId),
        eq(messages.watcherId, auth.user.id),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(10);

  return NextResponse.json({ messages: rows });
}
