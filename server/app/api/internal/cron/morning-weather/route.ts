import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { watchRelationships } from "@/app/db/schema";
import { db } from "@/lib/db";
import { getInternalCronToken } from "@/lib/env";
import { logger } from "@/lib/logger";
import { pushWidgetRefresh } from "@/lib/push";
import { fetchWeather, TOKYO_COORDINATES } from "@/lib/weather";

/**
 * POST /api/internal/cron/morning-weather
 * 全 active な見守られる側ユーザーへ、毎朝の天気を Widget 更新プッシュで届ける。
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

  const rels = await db
    .selectDistinct({ watchedId: watchRelationships.watchedId })
    .from(watchRelationships)
    .where(eq(watchRelationships.status, "active"));
  if (rels.length === 0) {
    return NextResponse.json({ pushed: 0 });
  }

  // TODO: ユーザーごとの位置情報対応(現状は全員に東京の天気を送る)
  let body: string;
  try {
    const weather = await fetchWeather(
      TOKYO_COORDINATES.lat,
      TOKYO_COORDINATES.lng,
    );
    body = `${weather.condition} 最高${Math.round(weather.temperatureMaxC)}度 / 最低${Math.round(weather.temperatureMinC)}度`;
  } catch (err) {
    logger.error("朝の天気取得に失敗したためプッシュを中止", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "weather_fetch_failed", pushed: 0 },
      { status: 502 },
    );
  }

  await Promise.allSettled(
    rels.map((r) =>
      pushWidgetRefresh(r.watchedId, { title: "今日の天気", body }),
    ),
  );

  return NextResponse.json({ pushed: rels.length });
}
