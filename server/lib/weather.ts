import { logger } from "./logger";

/**
 * Open-Meteo (https://open-meteo.com/) による天気取得。
 * API キー不要。WMO weather code を日本語ラベルへ変換して返す。
 * 同一座標(小数1桁丸め)への問い合わせは30分間インメモリキャッシュする。
 */

/** 座標省略時のデフォルト(東京駅付近) */
export const TOKYO_COORDINATES = { lat: 35.6812, lng: 139.7671 } as const;

export interface WeatherResult {
  /** 現在の天気の日本語ラベル(晴れ/くもり/雨 など) */
  condition: string;
  /** 現在気温(摂氏) */
  temperatureC: number;
  /** 本日の最高気温(摂氏) */
  temperatureMaxC: number;
  /** 本日の最低気温(摂氏) */
  temperatureMinC: number;
  /** 取得時刻(ISO文字列) */
  updatedAt: string;
}

/**
 * WMO weather code を日本語ラベルに変換する。
 * Widget 表示用の粗い粒度(詳細な強弱は区別しない)。
 */
export function weatherCodeToJa(code: number): string {
  if (code === 0) return "快晴";
  if (code === 1 || code === 2) return "晴れ";
  if (code === 3) return "くもり";
  if (code === 45 || code === 48) return "霧";
  if (code >= 51 && code <= 57) return "霧雨";
  if (code >= 61 && code <= 67) return "雨";
  if (code >= 71 && code <= 77) return "雪";
  if (code >= 80 && code <= 82) return "にわか雨";
  if (code === 85 || code === 86) return "にわか雪";
  if (code >= 95 && code <= 99) return "雷雨";
  return "不明";
}

const CACHE_TTL_MS = 30 * 60 * 1000;

interface CacheEntry {
  fetchedAt: number;
  data: WeatherResult;
}

const cache = new Map<string, CacheEntry>();

/** 座標を小数1桁に丸めてキャッシュキー化(約11km粒度) */
function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(1)},${lng.toFixed(1)}`;
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
  daily?: {
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
}

/**
 * Open-Meteo から現在天気と本日の最高/最低気温を取得する。
 * レスポンス不備・通信失敗時は例外を投げる(呼び出し側でフォールバック)。
 */
export async function fetchWeather(
  lat: number,
  lng: number,
): Promise<WeatherResult> {
  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.data;
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "1",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Open-Meteo リクエスト失敗: HTTP ${res.status}`);
  }
  const json = (await res.json()) as OpenMeteoResponse;

  const code = json.current?.weather_code ?? json.daily?.weather_code?.[0];
  const temperatureC = json.current?.temperature_2m;
  const temperatureMaxC = json.daily?.temperature_2m_max?.[0];
  const temperatureMinC = json.daily?.temperature_2m_min?.[0];
  if (
    typeof code !== "number" ||
    typeof temperatureC !== "number" ||
    typeof temperatureMaxC !== "number" ||
    typeof temperatureMinC !== "number"
  ) {
    throw new Error("Open-Meteo レスポンスに必要な値がありません");
  }

  const data: WeatherResult = {
    condition: weatherCodeToJa(code),
    temperatureC,
    temperatureMaxC,
    temperatureMinC,
    updatedAt: new Date().toISOString(),
  };
  cache.set(key, { fetchedAt: Date.now(), data });
  logger.debug("Open-Meteo から天気を取得", { key, condition: data.condition });
  return data;
}
