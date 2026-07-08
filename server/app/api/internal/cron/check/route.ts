import { NextResponse } from "next/server";
import { getInternalCronToken } from "@/lib/env";
import { tickAllWatched } from "@/lib/escalation-service";

/**
 * POST /api/internal/cron/check
 * 全 active watched に対してエスカレーション状態機械を1ステップ進める。
 * cron / Cloud Scheduler から Bearer INTERNAL_CRON_TOKEN で呼び出す。
 */
export async function POST(request: Request) {
  const expected = getInternalCronToken();
  if (!expected) {
    return NextResponse.json(
      { error: "cron_disabled", message: "INTERNAL_CRON_TOKEN が未設定です" },
      { status: 503 },
    );
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await tickAllWatched(new Date());
  return NextResponse.json(result);
}
