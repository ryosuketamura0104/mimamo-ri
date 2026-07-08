import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { messages, watchRelationships } from "@/app/db/schema";
import { db } from "@/lib/db";
import { pushWidgetRefresh } from "@/lib/push";
import { authenticate } from "../_lib/auth";
import { newId } from "../_lib/id";

/**
 * POST /api/v1/messages
 * 見守る側→見守られる側の Widget メッセージ投稿。
 * 投稿と同時に passive 通知で Widget 更新をトリガー。
 */
export async function POST(request: Request) {
  const auth = await authenticate(request, { requireRole: "watcher" });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    watchedId?: string;
    body?: string;
  } | null;
  if (!body?.watchedId || !body.body || body.body.trim().length === 0) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (body.body.length > 200) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }

  const rel = await db
    .select()
    .from(watchRelationships)
    .where(
      and(
        eq(watchRelationships.watcherId, auth.user.id),
        eq(watchRelationships.watchedId, body.watchedId),
        eq(watchRelationships.status, "active"),
      ),
    )
    .limit(1);
  if (rel.length === 0) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const inserted = await db
    .insert(messages)
    .values({
      id: newId(),
      watcherId: auth.user.id,
      watchedId: body.watchedId,
      body: body.body.trim(),
    })
    .returning();

  await pushWidgetRefresh(body.watchedId, {
    title: `${auth.user.name}さんからのメッセージ`,
    body: inserted[0].body,
  });

  return NextResponse.json({ message: inserted[0] }, { status: 201 });
}

/**
 * GET /api/v1/messages?watchedId=xxx&limit=1
 * Widget が最新メッセージを取得する用途(見守られる側自身のみ)。
 */
export async function GET(request: Request) {
  const auth = await authenticate(request, { requireRole: "watched" });
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "1"), 20);

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.watchedId, auth.user.id))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return NextResponse.json({ messages: rows });
}
