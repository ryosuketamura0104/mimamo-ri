import { describe, expect, it } from "vitest";
import { activeElapsedMinutes, isInQuiet, toLocalHHMM } from "./time";

describe("isInQuiet", () => {
  it("同一日内の静穏(13:00〜15:00)", () => {
    expect(isInQuiet("12:59", "13:00", "15:00")).toBe(false);
    expect(isInQuiet("13:00", "13:00", "15:00")).toBe(true);
    expect(isInQuiet("14:59", "13:00", "15:00")).toBe(true);
    expect(isInQuiet("15:00", "13:00", "15:00")).toBe(false);
  });

  it("日跨ぎの静穏(22:00〜07:00)", () => {
    expect(isInQuiet("21:59", "22:00", "07:00")).toBe(false);
    expect(isInQuiet("22:00", "22:00", "07:00")).toBe(true);
    expect(isInQuiet("00:00", "22:00", "07:00")).toBe(true);
    expect(isInQuiet("06:59", "22:00", "07:00")).toBe(true);
    expect(isInQuiet("07:00", "22:00", "07:00")).toBe(false);
    expect(isInQuiet("12:00", "22:00", "07:00")).toBe(false);
  });

  it("start == end は静穏無効", () => {
    expect(isInQuiet("12:00", "00:00", "00:00")).toBe(false);
  });
});

describe("toLocalHHMM", () => {
  it("JST での時刻取得", () => {
    // 2026-01-01 00:00 UTC = 09:00 JST
    const d = new Date("2026-01-01T00:00:00Z");
    expect(toLocalHHMM(d, "Asia/Tokyo")).toBe("09:00");
  });

  it("UTC の時刻取得", () => {
    const d = new Date("2026-01-01T13:45:00Z");
    expect(toLocalHHMM(d, "UTC")).toBe("13:45");
  });
});

describe("activeElapsedMinutes", () => {
  const opts = {
    quietStart: "22:00",
    quietEnd: "07:00",
    timezone: "Asia/Tokyo",
  };

  it("静穏時間帯外の1時間", () => {
    // JST 10:00 → 11:00
    const from = new Date("2026-01-01T01:00:00Z"); // 10:00 JST
    const to = new Date("2026-01-01T02:00:00Z"); // 11:00 JST
    expect(activeElapsedMinutes(from, to, opts)).toBe(60);
  });

  it("静穏時間帯を丸ごと含む(22:00〜07:00)", () => {
    // JST 20:00 → 翌 09:00 (13時間)。うち 22:00〜07:00 の 9時間 が静穏 → 4時間 = 240分
    const from = new Date("2026-01-01T11:00:00Z"); // 20:00 JST
    const to = new Date("2026-01-02T00:00:00Z"); // 09:00 JST
    expect(activeElapsedMinutes(from, to, opts)).toBe(240);
  });

  it("完全に静穏時間帯内", () => {
    // JST 23:00 → 翌 03:00(4h) はすべて静穏
    const from = new Date("2026-01-01T14:00:00Z"); // 23:00 JST
    const to = new Date("2026-01-01T18:00:00Z"); // 03:00 JST 翌
    expect(activeElapsedMinutes(from, to, opts)).toBe(0);
  });

  it("to < from は 0", () => {
    const a = new Date("2026-01-01T10:00:00Z");
    const b = new Date("2026-01-01T09:00:00Z");
    expect(activeElapsedMinutes(a, b, opts)).toBe(0);
  });

  it("静穏なし(quietStart==quietEnd) では全時間がアクティブ", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const to = new Date("2026-01-01T02:00:00Z");
    expect(
      activeElapsedMinutes(from, to, {
        quietStart: "00:00",
        quietEnd: "00:00",
        timezone: "Asia/Tokyo",
      }),
    ).toBe(120);
  });
});
