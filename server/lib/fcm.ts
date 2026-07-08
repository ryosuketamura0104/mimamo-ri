import { getFirebaseMessaging } from "./firebase-admin";
import { logger } from "./logger";

/**
 * FCM 送信ラッパー。firebase-admin の Messaging を使い、
 * 高優先度データメッセージ / 通知メッセージを送り分ける。
 */

export interface FcmSendParams {
  token: string;
  notification?: { title: string; body: string };
  data?: Record<string, string>;
  /** Doze 対策で高優先度データメッセージを使う場合 true */
  highPriority?: boolean;
}

export async function sendFcm(
  params: FcmSendParams,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return { ok: false, error: "no_messaging" };
  }
  try {
    const messageId = await messaging.send({
      token: params.token,
      notification: params.notification,
      data: params.data,
      android: {
        priority: params.highPriority ? "high" : "normal",
      },
    });
    return { ok: true, messageId };
  } catch (error) {
    logger.warn("FCM 送信失敗", {
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
