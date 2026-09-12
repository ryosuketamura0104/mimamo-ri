import http2 from "node:http2";
import { importPKCS8, SignJWT } from "jose";
import { getApnsEnv } from "./env";
import { logger } from "./logger";

/**
 * APNs 送信ラッパー(token-based, node:http2 で HTTP/2 接続)。
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

/**
 * APNs への HTTP/2 セッション。ホストごとに使い回す。
 *
 * Node の fetch(undici)は HTTP/2 を話せず、APNs は HTTP/2 必須のため
 * fetch では接続できない(レスポンスの HTTP/2 フレームを HTTP/1.1 として
 * 解釈しようとして HTTPParserError になる)。そのため node:http2 を直接使う。
 */
const sessions = new Map<string, http2.ClientHttp2Session>();

function getSession(host: string): http2.ClientHttp2Session {
  const existing = sessions.get(host);
  if (existing && !existing.closed && !existing.destroyed) return existing;

  const session = http2.connect(host);
  // セッションが死んだらキャッシュから外し、次回張り直す
  const drop = () => {
    if (sessions.get(host) === session) sessions.delete(host);
  };
  session.on("error", drop);
  session.on("close", drop);
  session.on("goaway", drop);
  sessions.set(host, session);
  return session;
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
    ":method": "POST",
    ":path": `/3/device/${params.deviceToken}`,
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

  const body = JSON.stringify(params.payload);

  const result = await new Promise<{ status: number; body: string }>(
    (resolve, reject) => {
      let req: http2.ClientHttp2Stream;
      try {
        req = getSession(host).request(headers);
      } catch (error) {
        reject(error);
        return;
      }
      let status = 0;
      let chunks = "";
      req.setEncoding("utf8");
      req.on("response", (h) => {
        status = Number(h[":status"] ?? 0);
      });
      req.on("data", (chunk) => {
        chunks += chunk;
      });
      req.on("end", () => resolve({ status, body: chunks }));
      req.on("error", reject);
      req.setTimeout(10_000, () => {
        req.close(http2.constants.NGHTTP2_CANCEL);
        reject(new Error("APNs リクエストがタイムアウトしました"));
      });
      req.end(body);
    },
  ).catch((error: unknown) => {
    logger.warn("APNs 送信でエラー", {
      message: error instanceof Error ? error.message : String(error),
      pushType: params.pushType,
    });
    return null;
  });

  if (!result) return { ok: false, status: 0, reason: "request_failed" };

  if (result.status >= 200 && result.status < 300) {
    return { ok: true, status: result.status };
  }
  logger.warn("APNs 送信失敗", {
    status: result.status,
    body: result.body,
    pushType: params.pushType,
  });
  return { ok: false, status: result.status, reason: result.body };
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
