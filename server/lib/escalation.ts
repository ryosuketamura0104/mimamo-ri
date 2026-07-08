import { activeElapsedMinutes } from "./time";

/**
 * エスカレーション状態機械の純粋関数実装。
 * DB や副作用に依存せず、入力から次のアクションのみを返す。
 * 実際の DB 更新・プッシュ送信は呼び出し側が担当する。
 *
 * ADR-0001 の設計:
 *   normal → (途絶検知) → confirming → (無応答1h) → alerted
 *   confirming/alerted → (人シグナル or 手動解消) → resolved
 */

export type EscalationState = "normal" | "confirming" | "alerted" | "resolved";

export type EscalationAction =
  | { kind: "no_op" }
  | { kind: "start_confirming"; lastHumanSignalAt: Date | null }
  | { kind: "escalate_to_alert" }
  | { kind: "resolve"; reason: "human_signal" | "checkin_tap" | "manual" };

export interface EscalationSettings {
  thresholdHours: number;
  quietStart: string;
  quietEnd: string;
  timezone: string;
  confirmingTimeoutMinutes?: number; // 既定 60
}

export interface EscalationInput {
  now: Date;
  /** 最新の「人の生存」シグナル時刻 */
  lastHumanSignalAt: Date | null;
  /** 現在の未解消エスカレーション(なければ null) */
  active: {
    state: EscalationState;
    startedAt: Date;
    confirmedAt: Date | null;
  } | null;
  settings: EscalationSettings;
  /** confirming 中に新規シグナルが到着したか */
  humanSignalArrivedDuringConfirming?: boolean;
}

/**
 * 現時点で取るべきアクションを判定する。
 */
export function evaluateEscalation(input: EscalationInput): EscalationAction {
  const {
    now,
    lastHumanSignalAt,
    active,
    settings,
    humanSignalArrivedDuringConfirming,
  } = input;

  const timeoutMin = settings.confirmingTimeoutMinutes ?? 60;

  // 既存のエスカレーションが confirming の場合の判定
  if (active && active.state === "confirming") {
    if (humanSignalArrivedDuringConfirming) {
      return { kind: "resolve", reason: "human_signal" };
    }
    // タイムアウトは実時間(静穏時間帯考慮なし)。本人確認通知への応答は即時性が求められるため。
    const elapsedMin = Math.floor(
      (now.getTime() - active.startedAt.getTime()) / 60_000,
    );
    if (elapsedMin >= timeoutMin) {
      return { kind: "escalate_to_alert" };
    }
    return { kind: "no_op" };
  }

  // 既存のエスカレーションが alerted の場合は状態機械側では何もしない
  // (手動解消 or 人シグナル受信で resolved になる)
  if (active && active.state === "alerted") {
    if (humanSignalArrivedDuringConfirming) {
      return { kind: "resolve", reason: "human_signal" };
    }
    return { kind: "no_op" };
  }

  // 通常状態: 途絶判定
  // 最終シグナルがない場合は「サービス開始からずっと途絶」ではなく、
  // オンボーディング完了 or 端末登録時刻を起点にすべき。
  // 呼び出し側で lastHumanSignalAt=デバイス登録時刻を渡す想定。
  if (!lastHumanSignalAt) {
    return { kind: "no_op" };
  }

  const activeMin = activeElapsedMinutes(lastHumanSignalAt, now, settings);
  const thresholdMin = settings.thresholdHours * 60;

  if (activeMin >= thresholdMin) {
    return { kind: "start_confirming", lastHumanSignalAt };
  }
  return { kind: "no_op" };
}
