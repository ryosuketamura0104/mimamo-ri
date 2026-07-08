import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  escalations,
  signals,
  users,
  watchRelationships,
} from "@/app/db/schema";
import { db } from "@/lib/db";
import { authenticate } from "../../../_lib/auth";

/**
 * GET /api/v1/watchers/me/watched
 * 見守る側の対象一覧: 最終シグナル時刻・状態バッジ用の情報を返す。
 */
export async function GET(request: Request) {
  const auth = await authenticate(request, { requireRole: "watcher" });
  if (!auth.ok) return auth.response;

  const rels = await db
    .select({ watchedId: watchRelationships.watchedId })
    .from(watchRelationships)
    .where(
      and(
        eq(watchRelationships.watcherId, auth.user.id),
        eq(watchRelationships.status, "active"),
      ),
    );

  if (rels.length === 0) return NextResponse.json({ watched: [] });

  const watchedIds = rels.map((r) => r.watchedId);
  const targetUsers = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, watchedIds));

  const results = await Promise.all(
    targetUsers.map(async (u) => {
      const lastSignalRow = await db
        .select({ observedAt: signals.observedAt, type: signals.type })
        .from(signals)
        .where(eq(signals.watchedId, u.id))
        .orderBy(desc(signals.observedAt))
        .limit(1);

      const activeEscalation = await db
        .select({
          id: escalations.id,
          state: escalations.state,
          startedAt: escalations.startedAt,
        })
        .from(escalations)
        .where(
          and(
            eq(escalations.watchedId, u.id),
            inArray(escalations.state, ["confirming", "alerted"]),
          ),
        )
        .orderBy(desc(escalations.startedAt))
        .limit(1);

      return {
        id: u.id,
        name: u.name,
        lastSignalAt: lastSignalRow[0]?.observedAt ?? null,
        lastSignalType: lastSignalRow[0]?.type ?? null,
        escalation: activeEscalation[0]
          ? {
              id: activeEscalation[0].id,
              state: activeEscalation[0].state,
              startedAt: activeEscalation[0].startedAt,
            }
          : null,
      };
    }),
  );

  return NextResponse.json({ watched: results });
}
