/**
 * タイムゾーンを考慮した時刻計算。
 * 静穏時間帯(HH:MM表記)の判定と、区間の有効経過時間の集計を提供する。
 */

/**
 * "HH:MM" 表記の時刻が静穏時間帯に含まれるか。
 * quietStart < quietEnd: 同一日内(例 13:00〜15:00)
 * quietStart >= quietEnd: 日跨ぎ(例 22:00〜07:00)。この場合 [quietStart, 24:00) と [00:00, quietEnd) の和集合
 */
export function isInQuiet(
  hhmm: string,
  quietStart: string,
  quietEnd: string,
): boolean {
  if (quietStart === quietEnd) return false;
  if (quietStart < quietEnd) {
    return hhmm >= quietStart && hhmm < quietEnd;
  }
  return hhmm >= quietStart || hhmm < quietEnd;
}

const hhmmFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getHhmmFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = hhmmFormatterCache.get(timezone);
  if (cached) return cached;
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  hhmmFormatterCache.set(timezone, f);
  return f;
}

/**
 * 指定タイムゾーンで Date を "HH:MM" 文字列に変換。
 */
export function toLocalHHMM(d: Date, timezone: string): string {
  const parts = getHhmmFormatter(timezone).formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  // Intl は稀に "24:00" を返すため正規化
  const h = hour === "24" ? "00" : hour;
  return `${h}:${minute}`;
}

/**
 * from〜to の間で「静穏時間帯を除いた」経過分数を返す。
 * 1分粒度で走査する素朴実装。1日(1440分)換算で十分高速。
 * to < from の場合は 0 を返す。
 */
export function activeElapsedMinutes(
  from: Date,
  to: Date,
  opts: { quietStart: string; quietEnd: string; timezone: string },
): number {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  if (toMs <= fromMs) return 0;

  // 1分粒度で走査
  const step = 60_000;
  let count = 0;
  for (let t = fromMs; t < toMs; t += step) {
    const hhmm = toLocalHHMM(new Date(t), opts.timezone);
    if (!isInQuiet(hhmm, opts.quietStart, opts.quietEnd)) {
      count++;
    }
  }
  return count;
}
