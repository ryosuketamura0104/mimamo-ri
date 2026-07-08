import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { watchSettings } from "@/app/db/schema";
import { db } from "@/lib/db";
import { authenticate } from "../../../_lib/auth";

/**
 * GET /api/v1/watched/me/settings
 * 見守られる側端末が自分の設定を取得する。
 * DeviceActivitySchedule の区間長、静穏時間帯、しきい値を同期する用途。
 */
export async function GET(request: Request) {
  const auth = await authenticate(request, { requireRole: "watched" });
  if (!auth.ok) return auth.response;

  const rows = await db
    .select()
    .from(watchSettings)
    .where(eq(watchSettings.watchedId, auth.user.id))
    .limit(1);
  const s = rows[0];
  if (!s) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    thresholdHours: s.thresholdHours,
    quietStart: s.quietStart,
    quietEnd: s.quietEnd,
    activityIntervalHours: s.activityIntervalHours,
    timezone: s.timezone,
  });
}
