import { desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  escalations,
  signals,
  users,
  watchRelationships,
} from "@/app/db/schema";
import { db } from "@/lib/db";
import { requireAdmin } from "../_lib/require-admin";

/**
 * GET /api/v1/admin/overview
 * 管理画面トップに表示するサマリ。
 */
export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  const [userCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      watchers: sql<number>`sum(case when role='watcher' then 1 else 0 end)::int`,
      watched: sql<number>`sum(case when role='watched' then 1 else 0 end)::int`,
    })
    .from(users);

  const [pairCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(watchRelationships)
    .where(eq(watchRelationships.status, "active"));

  const activeEscalations = await db
    .select()
    .from(escalations)
    .where(inArray(escalations.state, ["confirming", "alerted"]))
    .orderBy(desc(escalations.startedAt))
    .limit(50);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [signalRate] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(signals)
    .where(sql`${signals.reportedAt} >= ${oneHourAgo}`);

  return NextResponse.json({
    users: userCounts,
    activePairs: pairCount?.n ?? 0,
    signalsLastHour: signalRate?.n ?? 0,
    activeEscalations,
  });
}
