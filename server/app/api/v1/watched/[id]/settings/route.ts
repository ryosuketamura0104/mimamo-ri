import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { watchRelationships, watchSettings } from "@/app/db/schema";
import { db } from "@/lib/db";
import { authenticate } from "../../../_lib/auth";

async function verifyRelation(
  watcherId: string,
  watchedId: string,
): Promise<boolean> {
  const rel = await db
    .select()
    .from(watchRelationships)
    .where(
      and(
        eq(watchRelationships.watcherId, watcherId),
        eq(watchRelationships.watchedId, watchedId),
        eq(watchRelationships.status, "active"),
      ),
    )
    .limit(1);
  return rel.length > 0;
}

/**
 * GET /api/v1/watched/:id/settings
 * 見守る側が対象の見守り設定を取得する。
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request, { requireRole: "watcher" });
  if (!auth.ok) return auth.response;
  const { id: watchedId } = await ctx.params;
  if (!(await verifyRelation(auth.user.id, watchedId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const rows = await db
    .select()
    .from(watchSettings)
    .where(eq(watchSettings.watchedId, watchedId))
    .limit(1);
  if (rows.length === 0)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ settings: rows[0] });
}

/**
 * PUT /api/v1/watched/:id/settings
 * 見守る側が対象の見守り設定(しきい値・静穏時間帯・区間刻み)を更新する。
 * 呼び出し元が対象の watcher であることをリレーションで検証する。
 */
export async function PUT(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request, { requireRole: "watcher" });
  if (!auth.ok) return auth.response;

  const { id: watchedId } = await ctx.params;

  if (!(await verifyRelation(auth.user.id, watchedId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    thresholdHours?: number;
    quietStart?: string;
    quietEnd?: string;
    activityIntervalHours?: number;
    timezone?: string;
  } | null;
  if (!body)
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  // バリデーション
  if (
    body.thresholdHours !== undefined &&
    (body.thresholdHours < 1 || body.thresholdHours > 48)
  ) {
    return NextResponse.json({ error: "invalid_threshold" }, { status: 400 });
  }
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (body.quietStart !== undefined && !hhmm.test(body.quietStart)) {
    return NextResponse.json({ error: "invalid_quiet_start" }, { status: 400 });
  }
  if (body.quietEnd !== undefined && !hhmm.test(body.quietEnd)) {
    return NextResponse.json({ error: "invalid_quiet_end" }, { status: 400 });
  }
  if (
    body.activityIntervalHours !== undefined &&
    ![1, 2, 3, 4, 6, 8, 12].includes(body.activityIntervalHours)
  ) {
    return NextResponse.json({ error: "invalid_interval" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.thresholdHours !== undefined)
    patch.thresholdHours = body.thresholdHours;
  if (body.quietStart !== undefined) patch.quietStart = body.quietStart;
  if (body.quietEnd !== undefined) patch.quietEnd = body.quietEnd;
  if (body.activityIntervalHours !== undefined)
    patch.activityIntervalHours = body.activityIntervalHours;
  if (body.timezone !== undefined) patch.timezone = body.timezone;

  const updated = await db
    .update(watchSettings)
    .set(patch)
    .where(eq(watchSettings.watchedId, watchedId))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ settings: updated[0] });
}
