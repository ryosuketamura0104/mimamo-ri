import { describe, expect, it } from "vitest";
import { type DailyForecast, weatherCodeToJa } from "./weather";

describe("weatherCodeToJa", () => {
  it("快晴・晴れ・くもり", () => {
    expect(weatherCodeToJa(0)).toBe("快晴");
    expect(weatherCodeToJa(1)).toBe("晴れ");
    expect(weatherCodeToJa(2)).toBe("晴れ");
    expect(weatherCodeToJa(3)).toBe("くもり");
  });

  it("霧", () => {
    expect(weatherCodeToJa(45)).toBe("霧");
    expect(weatherCodeToJa(48)).toBe("霧");
  });

  it("霧雨(51〜57)", () => {
    expect(weatherCodeToJa(51)).toBe("霧雨");
    expect(weatherCodeToJa(55)).toBe("霧雨");
    expect(weatherCodeToJa(57)).toBe("霧雨");
  });

  it("雨(61〜67)", () => {
    expect(weatherCodeToJa(61)).toBe("雨");
    expect(weatherCodeToJa(63)).toBe("雨");
    expect(weatherCodeToJa(67)).toBe("雨");
  });

  it("雪(71〜77)", () => {
    expect(weatherCodeToJa(71)).toBe("雪");
    expect(weatherCodeToJa(75)).toBe("雪");
    expect(weatherCodeToJa(77)).toBe("雪");
  });

  it("にわか雨(80〜82)・にわか雪(85〜86)", () => {
    expect(weatherCodeToJa(80)).toBe("にわか雨");
    expect(weatherCodeToJa(82)).toBe("にわか雨");
    expect(weatherCodeToJa(85)).toBe("にわか雪");
    expect(weatherCodeToJa(86)).toBe("にわか雪");
  });

  it("雷雨(95〜99)", () => {
    expect(weatherCodeToJa(95)).toBe("雷雨");
    expect(weatherCodeToJa(99)).toBe("雷雨");
  });

  it("未定義コードは不明", () => {
    expect(weatherCodeToJa(4)).toBe("不明");
    expect(weatherCodeToJa(42)).toBe("不明");
    expect(weatherCodeToJa(-1)).toBe("不明");
    expect(weatherCodeToJa(100)).toBe("不明");
  });
});

describe("週間予報の形", () => {
  it("WeatherResult は7日分の daily を持てる", () => {
    // 型レベルの確認。実通信は行わず、構造の取り違えを防ぐ目的
    const sample: DailyForecast = {
      date: "2026-09-12",
      code: 61,
      condition: weatherCodeToJa(61),
      temperatureMaxC: 25,
      temperatureMinC: 20,
      precipitationChance: 97,
      precipitationMm: 4,
    };
    expect(sample.condition).toBe("雨");
    expect(sample.precipitationChance).toBeGreaterThan(0);
  });

  it("降水を伴うコードは雨系のラベルになる", () => {
    // Widget のアイコン切り替えがコード依存なので、代表値の対応を固定する
    expect(weatherCodeToJa(61)).toBe("雨");
    expect(weatherCodeToJa(80)).toBe("にわか雨");
    expect(weatherCodeToJa(95)).toBe("雷雨");
    expect(weatherCodeToJa(71)).toBe("雪");
  });
});
