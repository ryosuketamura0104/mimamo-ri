import { importPKCS8, SignJWT } from "jose";
import { getApnsEnv } from "./env";
import { logger } from "./logger";

/**
 * APNs 送信ラッパー(token-based, HTTP/2 経由の fetch)。
 * push-type と interruption-level を明示的に指定できるようにする。
 */

const APNS_HOST_PROD = "https://api.push.apple.com";
const APNS_HOST_DEV = "https://api.sandbox.push.apple.com";

export type ApnsPushType =
  | "alert"
  | "background"
  | "location"
  | "voip"
  | "complication"
  | "fileprovider"
  | "mdm";

export type InterruptionLevel =
  | "passive"
  | "active"
  | "time-sensitive"
  | "critical";

export interface ApnsSendParams {
  deviceToken: string;
  pushType: ApnsPushType;
  payload: Record<string, unknown>;
  /** priority: 10=即時, 5=節電優先, 1=最遅(background/location推奨) */
  priority?: 10 | 5 | 1;
  expiration?: number; // Unix epoch。0 で即時破棄不可
  collapseId?: string;
  topic?: string; // 通常は bundleId、location push は bundleId.location-query 等
}

let cachedJwt: { token: string; issuedAt: number } | null = null;

async function makeJwt(): Promise<string | null> {
  const { keyId, teamId, privateKey } = getApnsEnv();
  if (!keyId || !teamId || !privateKey) {
    logger.warn("APNs 認証情報が未設定のため送信をスキップします");
    return null;
  }
  // APNs は JWT を 20分〜1時間で更新する必要がある。30分でローテート。
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.issuedAt < 30 * 60) {
    return cachedJwt.token;
  }
  const alg = "ES256";
  const key = await importPKCS8(privateKey, alg);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg, kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .sign(key);
  cachedJwt = { token, issuedAt: now };
  return token;
}

export async function sendApns(
  params: ApnsSendParams,
): Promise<{ ok: boolean; status: number; reason?: string }> {
  const { env, bundleId } = getApnsEnv();
  const jwt = await makeJwt();
  if (!jwt) return { ok: false, status: 0, reason: "no_credentials" };

  const host = env === "production" ? APNS_HOST_PROD : APNS_HOST_DEV;
  const topic = params.topic ?? bundleId;
  const priority =
    params.priority ??
    (params.pushType === "background" || params.pushType === "location"
      ? 5
      : 10);

  const headers: Record<string, string> = {
    authorization: `bearer ${jwt}`,
    "apns-topic": topic,
    "apns-push-type": params.pushType,
    "apns-priority": String(priority),
  };
  if (params.expiration !== undefined) {
    headers["apns-expiration"] = String(params.expiration);
  }
  if (params.collapseId) {
    headers["apns-collapse-id"] = params.collapseId;
  }

  const url = `${host}/3/device/${params.deviceToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(params.payload),
  });

  if (res.ok) return { ok: true, status: res.status };
  const body = await res.text();
  logger.warn("APNs 送信失敗", {
    status: res.status,
    body,
    pushType: params.pushType,
  });
  return { ok: false, status: res.status, reason: body };
}

/**
 * 通常の表示通知 (interruption-level 指定可)
 */
export function apnsAlertPayload(opts: {
  title: string;
  body: string;
  interruptionLevel?: InterruptionLevel;
  data?: Record<string, unknown>;
  mutableContent?: boolean;
  /** iOS 側で登録した通知カテゴリ ID(アクションボタン表示用) */
  category?: string;
}): Record<string, unknown> {
  return {
    aps: {
      alert: { title: opts.title, body: opts.body },
      sound: "default",
      "interruption-level": opts.interruptionLevel ?? "active",
      ...(opts.mutableContent ? { "mutable-content": 1 } : {}),
      ...(opts.category ? { category: opts.category } : {}),
    },
    ...(opts.data ?? {}),
  };
}

/**
 * サイレント/バックグラウンド更新用 (content-available)
 */
export function apnsBackgroundPayload(
  data?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    aps: { "content-available": 1 },
    ...(data ?? {}),
  };
}

/**
 * ロケーションプッシュ用 (CLLocationPushServiceExtension を起動)
 */
export function apnsLocationPayload(
  data?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    aps: {},
    ...(data ?? {}),
  };
}
