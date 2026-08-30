import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { messages } from "@/app/db/schema";
import { db } from "@/lib/db";
import { authenticate } from "../../../_lib/auth";

/**
 * POST /api/v1/messages/:id/read
 * 見守られる側がメッセージを既読にする。
 * readAt が null の場合のみ現在時刻を設定する(冪等)。
 * 既読の生存シグナルはクライアントが別途 checkin_tap を送る設計のため、
 * ここではシグナルを記録しない。
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request, { requireRole: "watched" });
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1);
  const message = rows[0];
  if (!message || message.watchedId !== auth.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (message.readAt) {
    return NextResponse.json({ message });
  }

  const updated = await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.id, id), isNull(messages.readAt)))
    .returning();

  // 同時リクエストで先に既読化された場合は最新行を返す
  return NextResponse.json({ message: updated[0] ?? message });
}
