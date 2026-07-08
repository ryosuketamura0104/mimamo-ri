import { NextResponse } from "next/server";
import { signals } from "@/app/db/schema";
import { db } from "@/lib/db";
import { resolveActiveEscalationForUser } from "@/lib/escalation-service";
import { authenticate } from "../_lib/auth";
import { newId } from "../_lib/id";

/**
 * POST /api/v1/checkin
 * 本人確認通知への応答「元気です」ボタンから呼ばれる。
 * checkin_tap シグナルを記録し、アクティブなエスカレーションを解消する。
 */
export async function POST(request: Request) {
  const auth = await authenticate(request, { requireRole: "watched" });
  if (!auth.ok) return auth.response;

  const now = new Date();
  await db
    .insert(signals)
    .values({
      id: newId(),
      watchedId: auth.user.id,
      type: "checkin_tap",
      observedAt: now,
    })
    .onConflictDoNothing({
      target: [
        signals.watchedId,
        signals.type,
        signals.observedAt,
        signals.deviceId,
      ],
    });

  const resolvedId = await resolveActiveEscalationForUser(
    auth.user.id,
    "checkin_tap",
  );
  return NextResponse.json({ resolvedEscalationId: resolvedId });
}
