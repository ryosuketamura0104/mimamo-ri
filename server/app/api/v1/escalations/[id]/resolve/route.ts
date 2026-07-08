import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { escalations, watchRelationships } from "@/app/db/schema";
import { db } from "@/lib/db";
import { authenticate } from "../../../_lib/auth";

/**
 * POST /api/v1/escalations/:id/resolve
 * 見守る側がアラートを手動で解消する。
 * 呼び出し元が当該 escalation の watched に対する watcher であることを検証。
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request, { requireRole: "watcher" });
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const rows = await db
    .select()
    .from(escalations)
    .where(eq(escalations.id, id))
    .limit(1);
  const esc = rows[0];
  if (!esc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (esc.state === "resolved") {
    return NextResponse.json({ error: "already_resolved" }, { status: 409 });
  }

  const rel = await db
    .select()
    .from(watchRelationships)
    .where(
      and(
        eq(watchRelationships.watcherId, auth.user.id),
        eq(watchRelationships.watchedId, esc.watchedId),
        eq(watchRelationships.status, "active"),
      ),
    )
    .limit(1);
  if (rel.length === 0) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const updated = await db
    .update(escalations)
    .set({
      state: "resolved",
      resolvedAt: new Date(),
      resolvedBy: auth.user.id,
    })
    .where(eq(escalations.id, id))
    .returning();
  return NextResponse.json({ escalation: updated[0] });
}
