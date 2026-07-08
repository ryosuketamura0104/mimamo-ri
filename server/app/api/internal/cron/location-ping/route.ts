import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { devices, watchRelationships } from "@/app/db/schema";
import { db } from "@/lib/db";
import { getInternalCronToken } from "@/lib/env";
import { pushLocationPing } from "@/lib/push";

/**
 * POST /api/internal/cron/location-ping
 * 全 active watched の iOS 端末にロケーションプッシュ ping を送信する。
 * 毎時実行することで、拡張が起動して位置+ロック状態+滞留シグナルを報告する。
 */
export async function POST(request: Request) {
  const expected = getInternalCronToken();
  if (!expected) {
    return NextResponse.json({ error: "cron_disabled" }, { status: 503 });
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rels = await db
    .selectDistinct({ watchedId: watchRelationships.watchedId })
    .from(watchRelationships)
    .where(eq(watchRelationships.status, "active"));

  if (rels.length === 0) return NextResponse.json({ sent: 0 });

  const watchedIds = rels.map((r) => r.watchedId);
  const iosDevices = await db
    .select({ userId: devices.userId })
    .from(devices)
    .where(
      and(inArray(devices.userId, watchedIds), eq(devices.platform, "ios")),
    );

  const uniqueWatched = Array.from(new Set(iosDevices.map((d) => d.userId)));
  await Promise.allSettled(uniqueWatched.map((uid) => pushLocationPing(uid)));

  return NextResponse.json({ sent: uniqueWatched.length });
}
