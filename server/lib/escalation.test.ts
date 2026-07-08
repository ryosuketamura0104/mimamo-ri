import { describe, expect, it } from "vitest";
import { type EscalationSettings, evaluateEscalation } from "./escalation";

const baseSettings: EscalationSettings = {
  thresholdHours: 12,
  quietStart: "22:00",
  quietEnd: "07:00",
  timezone: "Asia/Tokyo",
  confirmingTimeoutMinutes: 60,
};

describe("evaluateEscalation - normal 状態", () => {
  it("最終シグナルなしは no_op", () => {
    const action = evaluateEscalation({
      now: new Date("2026-01-01T12:00:00Z"),
      lastHumanSignalAt: null,
      active: null,
      settings: baseSettings,
    });
    expect(action.kind).toBe("no_op");
  });

  it("しきい値未満は no_op", () => {
    // 6時間経過(すべてアクティブ帯) → 12h 未満
    const action = evaluateEscalation({
      now: new Date("2026-01-01T05:00:00Z"), // 14:00 JST
      lastHumanSignalAt: new Date("2026-01-01T00:00:00Z"), // 09:00 JST 前日
      active: null,
      settings: baseSettings,
    });
    expect(action.kind).toBe("no_op");
  });

  it("しきい値超えは start_confirming", () => {
    // JST 09:00 → 翌 09:00(24h)。うち 22:00〜07:00 の 9時間が静穏 → アクティブ 15h > 12h
    const lastHuman = new Date("2026-01-01T00:00:00Z"); // 09:00 JST
    const now = new Date("2026-01-02T00:00:00Z"); // 翌 09:00 JST
    const action = evaluateEscalation({
      now,
      lastHumanSignalAt: lastHuman,
      active: null,
      settings: baseSettings,
    });
    expect(action.kind).toBe("start_confirming");
  });

  it("静穏時間帯が長ければしきい値に達しない", () => {
    // 24h 経過だがすべて静穏(quietStart=00:00, quietEnd=23:59)
    const opts: EscalationSettings = {
      thresholdHours: 12,
      quietStart: "00:00",
      quietEnd: "23:59",
      timezone: "Asia/Tokyo",
    };
    const action = evaluateEscalation({
      now: new Date("2026-01-02T00:00:00Z"),
      lastHumanSignalAt: new Date("2026-01-01T00:00:00Z"),
      active: null,
      settings: opts,
    });
    expect(action.kind).toBe("no_op");
  });
});

describe("evaluateEscalation - confirming 状態", () => {
  const active = {
    state: "confirming" as const,
    startedAt: new Date("2026-01-01T00:00:00Z"),
    confirmedAt: null,
  };

  it("人シグナル到着で resolve", () => {
    const action = evaluateEscalation({
      now: new Date("2026-01-01T00:10:00Z"),
      lastHumanSignalAt: new Date("2026-01-01T00:08:00Z"),
      active,
      settings: baseSettings,
      humanSignalArrivedDuringConfirming: true,
    });
    expect(action.kind).toBe("resolve");
  });

  it("60分未満は no_op", () => {
    const action = evaluateEscalation({
      now: new Date("2026-01-01T00:30:00Z"),
      lastHumanSignalAt: null,
      active,
      settings: baseSettings,
    });
    expect(action.kind).toBe("no_op");
  });

  it("60分経過で escalate_to_alert", () => {
    const action = evaluateEscalation({
      now: new Date("2026-01-01T01:00:00Z"),
      lastHumanSignalAt: null,
      active,
      settings: baseSettings,
    });
    expect(action.kind).toBe("escalate_to_alert");
  });
});

describe("evaluateEscalation - alerted 状態", () => {
  const active = {
    state: "alerted" as const,
    startedAt: new Date("2026-01-01T00:00:00Z"),
    confirmedAt: new Date("2026-01-01T00:05:00Z"),
  };

  it("追加シグナルなしは no_op(手動解消待ち)", () => {
    const action = evaluateEscalation({
      now: new Date("2026-01-01T05:00:00Z"),
      lastHumanSignalAt: null,
      active,
      settings: baseSettings,
    });
    expect(action.kind).toBe("no_op");
  });

  it("人シグナル到着で resolve", () => {
    const action = evaluateEscalation({
      now: new Date("2026-01-01T05:00:00Z"),
      lastHumanSignalAt: new Date("2026-01-01T04:50:00Z"),
      active,
      settings: baseSettings,
      humanSignalArrivedDuringConfirming: true,
    });
    expect(action.kind).toBe("resolve");
  });
});
