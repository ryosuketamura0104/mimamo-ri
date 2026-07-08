import { NextResponse } from "next/server";
import {
  HUMAN_SIGNAL_TYPES,
  STEPS_SIGNAL_TYPE,
  signals,
} from "@/app/db/schema";
import { db } from "@/lib/db";
import { resolveActiveEscalationForUser } from "@/lib/escalation-service";
import { authenticate } from "../_lib/auth";
import { newId } from "../_lib/id";

/**
 * POST /api/v1/signals
 * 見守られる側の端末からシグナルをバッチ報告する。
 * 冪等: (watchedId, type, observedAt, deviceId) が同一なら重複挿入しない。
 * 人シグナルを含む場合、既存の confirming/alerted エスカレーションを解消する。
 */

interface SignalItem {
  type: string;
  observedAt: string; // ISO 8601
  deviceId?: string;
  meta?: Record<string, unknown>;
}

function isHumanSignal(item: SignalItem): boolean {
  if (HUMAN_SIGNAL_TYPES.has(item.type)) return true;
  if (item.type === STEPS_SIGNAL_TYPE) {
    const steps = Number(item.meta?.steps ?? 0);
    return steps > 0;
  }
  return false;
}

export async function POST(request: Request) {
  const auth = await authenticate(request, { requireRole: "watched" });
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const body = (await request.json().catch(() => null)) as {
    signals?: SignalItem[];
  } | null;
  if (
    !body?.signals ||
    !Array.isArray(body.signals) ||
    body.signals.length === 0
  ) {
    return NextResponse.json(
      { error: "invalid_body", message: "signals 配列が必要です" },
      { status: 400 },
    );
  }
  if (body.signals.length > 500) {
    return NextResponse.json(
      { error: "too_many", message: "1リクエスト500件まで" },
      { status: 400 },
    );
  }

  const rows = body.signals
    .filter(
      (s) => typeof s.type === "string" && typeof s.observedAt === "string",
    )
    .map((s) => ({
      id: newId(),
      watchedId: user.id,
      deviceId: s.deviceId ?? null,
      type: s.type,
      observedAt: new Date(s.observedAt),
      meta: s.meta ?? null,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }

  // 冪等: dedup キーで衝突したら無視
  const inserted = await db
    .insert(signals)
    .values(rows)
    .onConflictDoNothing({
      target: [
        signals.watchedId,
        signals.type,
        signals.observedAt,
        signals.deviceId,
      ],
    })
    .returning({ id: signals.id });

  // 人シグナルを含む場合はエスカレーション解消
  const hasHuman = body.signals.some(isHumanSignal);
  let resolvedEscalationId: string | null = null;
  if (hasHuman) {
    resolvedEscalationId = await resolveActiveEscalationForUser(
      user.id,
      "human_signal",
    );
  }

  return NextResponse.json({
    inserted: inserted.length,
    resolvedEscalationId,
  });
}
