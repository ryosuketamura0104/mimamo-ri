import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { escalations, watchRelationships } from "@/app/db/schema";
import { db } from "@/lib/db";
import { authenticate } from "../../../_lib/auth";

/**
 * GET /api/v1/watched/:id/escalations?limit=20
 * 見守る側が対象のエスカレーション履歴(全state)を取得する。
 */
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
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);

  const rows = await db
    .select()
    .from(escalations)
    .where(eq(escalations.watchedId, watchedId))
    .orderBy(desc(escalations.startedAt))
    .limit(limit);

  return NextResponse.json({ escalations: rows });
}
