import { and, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { signals, watchRelationships } from "@/app/db/schema";
import { db } from "@/lib/db";
import { authenticate } from "../../../_lib/auth";

/**
 * GET /api/v1/watched/:id/telemetry?days=7
 *
 * 「アプリを開かれない前提」の各経路が実際にどれだけ機能しているかを集計する。
 * 発表用の実測値を出すための計測 API。
 *
 * 出すもの:
 *   - Widget が現実に何回・どんな間隔で発火したか(時間帯分布、最大の空白)
 *   - 発火が途切れた前後の端末コンディション(低電力モード・ロック・残量)
 *   - ロック解除の捕捉率比較: 常駐方式のイベント vs サンプリング
 */

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx];
}

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

  const url = new URL(request.url);
  const days = Math.min(
    Math.max(Number(url.searchParams.get("days") ?? "7"), 1),
    90,
  );
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      type: signals.type,
      observedAt: signals.observedAt,
      meta: signals.meta,
    })
    .from(signals)
    .where(
      and(eq(signals.watchedId, watchedId), gte(signals.observedAt, since)),
    )
    .orderBy(signals.observedAt);

  const tz = "Asia/Tokyo";
  const hourFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
  });
  const dayFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const widgetRows = rows.filter((r) => r.type === "widget_probe");

  // 時間帯・日別の分布
  const byHour = new Array(24).fill(0) as number[];
  const perDayMap = new Map<string, number>();
  for (const r of widgetRows) {
    const h = Number(hourFmt.format(r.observedAt));
    if (!Number.isNaN(h)) byHour[h % 24] += 1;
    const d = dayFmt.format(r.observedAt);
    perDayMap.set(d, (perDayMap.get(d) ?? 0) + 1);
  }

  // 発火間隔。端末側が meta.gap_s を持っていればそれを使い、無ければ観測時刻の差で補う
  const gaps: {
    gapS: number;
    at: Date;
    meta: Record<string, unknown> | null;
  }[] = [];
  for (let i = 0; i < widgetRows.length; i++) {
    const r = widgetRows[i];
    const fromMeta = Number((r.meta as Record<string, unknown> | null)?.gap_s);
    let gapS: number | null = Number.isFinite(fromMeta) ? fromMeta : null;
    if (gapS === null && i > 0) {
      gapS = Math.round(
        (r.observedAt.getTime() - widgetRows[i - 1].observedAt.getTime()) /
          1000,
      );
    }
    if (gapS !== null && gapS >= 0) {
      gaps.push({
        gapS,
        at: r.observedAt,
        meta: r.meta as Record<string, unknown> | null,
      });
    }
  }
  const sortedGaps = gaps.map((g) => g.gapS).sort((a, b) => a - b);

  // 完全な1日分が揃っている日だけで平均を出す(初日・最終日は計測が途中で始まる/終わるため除外)
  const perDaySorted = [...perDayMap.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const completeDays =
    perDaySorted.length >= 3 ? perDaySorted.slice(1, -1) : perDaySorted;
  const averagePerCompleteDay = completeDays.length
    ? Number(
        (
          completeDays.reduce((sum, [, n]) => sum + n, 0) / completeDays.length
        ).toFixed(1),
      )
    : null;

  // 更新が途切れた場面の手がかり: 長い空白の直後に記録されたコンディション
  const longestGaps = [...gaps]
    .sort((a, b) => b.gapS - a.gapS)
    .slice(0, 10)
    .map((g) => ({
      resumedAt: g.at,
      gapMinutes: Math.round(g.gapS / 60),
      lowPower: g.meta?.low_power === "true",
      locked: g.meta?.locked === "true",
      batteryState: (g.meta?.battery as string | undefined) ?? null,
      batteryLevel: g.meta?.level ? Number(g.meta.level) : null,
    }));

  // 低電力モード中の発火がどれだけ落ちるか
  const withLowPower = widgetRows.filter(
    (r) => (r.meta as Record<string, unknown> | null)?.low_power === "true",
  ).length;

  const count = (type: string) => rows.filter((r) => r.type === type).length;

  const unlockEvents = count("unlock_event");
  const unlockProbes = count("unlock_probe");

  return NextResponse.json({
    range: { since: since.toISOString(), days, timezone: tz },
    widget: {
      total: widgetRows.length,
      perDay: perDaySorted.map(([date, fires]) => ({ date, fires })),
      completeDaysUsedForAverage: completeDays.length,
      // 平均は「要求期間」ではなく「実際にデータがある日」で割る。
      // さらに端が欠けた初日・最終日は除外しないと過小評価になる
      averagePerDay: averagePerCompleteDay,
      byHour,
      gapMinutes: {
        median: sortedGaps.length
          ? Math.round((percentile(sortedGaps, 50) ?? 0) / 60)
          : null,
        p90: sortedGaps.length
          ? Math.round((percentile(sortedGaps, 90) ?? 0) / 60)
          : null,
        max: sortedGaps.length
          ? Math.round(sortedGaps[sortedGaps.length - 1] / 60)
          : null,
      },
      gapsOver1h: gaps.filter((g) => g.gapS >= 3600).length,
      gapsOver3h: gaps.filter((g) => g.gapS >= 3 * 3600).length,
      firesWhileLowPower: withLowPower,
      longestGaps,
    },
    unlock: {
      // 常駐方式で取れた「イベント」
      events: unlockEvents,
      // 拡張が起きた瞬間にたまたま解除中だった「サンプリング」
      probes: unlockProbes,
      // イベントが取れているなら、サンプリングが何倍取りこぼしていたかの目安
      captureRatio:
        unlockProbes > 0 && unlockEvents > 0
          ? Number((unlockEvents / unlockProbes).toFixed(2))
          : null,
    },
    charging: { starts: count("charging_start") },
    other: {
      appOpen: count("app_open"),
      checkinTap: count("checkin_tap"),
      steps: count("steps"),
      nse: count("nse"),
      screenTime: count("screen_time"),
    },
  });
}
