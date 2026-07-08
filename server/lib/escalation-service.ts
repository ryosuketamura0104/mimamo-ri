import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { newId } from "@/app/api/v1/_lib/id";
import {
  escalations,
  HUMAN_SIGNAL_TYPES,
  STEPS_SIGNAL_TYPE,
  signals,
  users,
  watchRelationships,
  watchSettings,
} from "@/app/db/schema";
import { db } from "./db";
import { type EscalationSettings, evaluateEscalation } from "./escalation";
import { logger } from "./logger";
import { pushCheckinRequest, pushWatcherAlert } from "./push";

/**
 * エスカレーション状態機械の DB 連携。
 * evaluateEscalation の判定結果を DB 更新 + プッシュ送信に落とす。
 */

async function getLastHumanSignalAt(watchedId: string): Promise<Date | null> {
  const humanTypes = Array.from(HUMAN_SIGNAL_TYPES);
  const rows = await db
    .select({ observedAt: signals.observedAt })
    .from(signals)
    .where(
      and(eq(signals.watchedId, watchedId), inArray(signals.type, humanTypes)),
    )
    .orderBy(desc(signals.observedAt))
    .limit(1);
  const nonSteps = rows[0]?.observedAt ?? null;

  // 歩数は meta.steps > 0 のもののみを人シグナルとみなす
  const stepRows = await db
    .select({ observedAt: signals.observedAt, meta: signals.meta })
    .from(signals)
    .where(
      and(
        eq(signals.watchedId, watchedId),
        eq(signals.type, STEPS_SIGNAL_TYPE),
        sql`(${signals.meta}->>'steps')::int > 0`,
      ),
    )
    .orderBy(desc(signals.observedAt))
    .limit(1);
  const stepsAt = stepRows[0]?.observedAt ?? null;

  if (!nonSteps) return stepsAt;
  if (!stepsAt) return nonSteps;
  return nonSteps > stepsAt ? nonSteps : stepsAt;
}

async function getSettings(
  watchedId: string,
): Promise<EscalationSettings | null> {
  const rows = await db
    .select()
    .from(watchSettings)
    .where(eq(watchSettings.watchedId, watchedId))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    thresholdHours: r.thresholdHours,
    quietStart: r.quietStart,
    quietEnd: r.quietEnd,
    timezone: r.timezone,
  };
}

async function getActiveEscalation(watchedId: string) {
  const rows = await db
    .select()
    .from(escalations)
    .where(
      and(
        eq(escalations.watchedId, watchedId),
        inArray(escalations.state, ["confirming", "alerted"]),
      ),
    )
    .orderBy(desc(escalations.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 指定 watched ユーザーに対して現在の状態を1ステップ進める。
 * cron から全 active watched に対して呼び出す想定。
 */
export async function tickEscalationForUser(
  watchedId: string,
  now: Date = new Date(),
): Promise<void> {
  const settings = await getSettings(watchedId);
  if (!settings) return;

  const active = await getActiveEscalation(watchedId);
  const lastHuman = await getLastHumanSignalAt(watchedId);

  // confirming 中の人シグナル判定:
  // active.startedAt 以降に来た人シグナルがあれば true
  let humanArrived = false;
  if (
    active &&
    active.state === "confirming" &&
    lastHuman &&
    lastHuman > active.startedAt
  ) {
    humanArrived = true;
  }

  const action = evaluateEscalation({
    now,
    lastHumanSignalAt: lastHuman,
    active: active
      ? {
          state: active.state as "confirming" | "alerted",
          startedAt: active.startedAt,
          confirmedAt: active.confirmedAt,
        }
      : null,
    settings,
    humanSignalArrivedDuringConfirming: humanArrived,
  });

  switch (action.kind) {
    case "no_op":
      return;
    case "start_confirming": {
      const id = newId();
      await db.insert(escalations).values({
        id,
        watchedId,
        state: "confirming",
        lastSignalAt: lastHuman,
      });
      logger.info("エスカレーション開始 → confirming", {
        watchedId,
        escalationId: id,
      });
      await pushCheckinRequest(watchedId, id);
      return;
    }
    case "escalate_to_alert": {
      if (!active) return;
      await db
        .update(escalations)
        .set({ state: "alerted", alertedAt: now })
        .where(eq(escalations.id, active.id));
      logger.info("エスカレーション → alerted", {
        watchedId,
        escalationId: active.id,
      });
      await notifyAllWatchers(watchedId, active.id, active.lastSignalAt);
      return;
    }
    case "resolve": {
      if (!active) return;
      await db
        .update(escalations)
        .set({ state: "resolved", resolvedAt: now })
        .where(eq(escalations.id, active.id));
      logger.info("エスカレーション → resolved", {
        watchedId,
        escalationId: active.id,
        reason: action.reason,
      });
      return;
    }
  }
}

async function notifyAllWatchers(
  watchedId: string,
  escalationId: string,
  lastSignalAt: Date | null,
): Promise<void> {
  const watchedRows = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, watchedId))
    .limit(1);
  const watchedName = watchedRows[0]?.name ?? "見守り対象";

  const rels = await db
    .select({ watcherId: watchRelationships.watcherId })
    .from(watchRelationships)
    .where(
      and(
        eq(watchRelationships.watchedId, watchedId),
        eq(watchRelationships.status, "active"),
      ),
    );

  await Promise.allSettled(
    rels.map((r) =>
      pushWatcherAlert(r.watcherId, {
        watchedName,
        escalationId,
        lastSignalAt: lastSignalAt?.toISOString() ?? null,
      }),
    ),
  );
}

/**
 * 人シグナル受信時に呼び出す解消処理。
 * 未解決の confirming/alerted があれば resolved にする。返り値は解消した escalation ID。
 */
export async function resolveActiveEscalationForUser(
  watchedId: string,
  reason: "human_signal" | "checkin_tap" | "manual",
  resolvedBy?: string,
): Promise<string | null> {
  const active = await getActiveEscalation(watchedId);
  if (!active) return null;
  await db
    .update(escalations)
    .set({
      state: "resolved",
      resolvedAt: new Date(),
      resolvedBy: resolvedBy ?? null,
    })
    .where(eq(escalations.id, active.id));
  logger.info("エスカレーション解消", {
    watchedId,
    escalationId: active.id,
    reason,
  });
  return active.id;
}

/**
 * cron からの一括処理: 見守り関係で active になっている watched を全部巡回。
 */
export async function tickAllWatched(
  now: Date = new Date(),
): Promise<{ processed: number }> {
  const rows = await db
    .selectDistinct({ watchedId: watchRelationships.watchedId })
    .from(watchRelationships)
    .where(eq(watchRelationships.status, "active"));
  await Promise.allSettled(
    rows.map((r) => tickEscalationForUser(r.watchedId, now)),
  );
  return { processed: rows.length };
}
