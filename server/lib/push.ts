import { and, eq } from "drizzle-orm";
import { devices } from "@/app/db/schema";
import { apnsAlertPayload, apnsLocationPayload, sendApns } from "./apns";
import { db } from "./db";
import { getApnsEnv } from "./env";
import { sendFcm } from "./fcm";
import { logger } from "./logger";

/**
 * プラットフォーム抽象化された高レベルプッシュ送信。
 * ユースケース:
 *   - 本人確認通知(見守られる側): 表示通知(音あり、time-sensitive)
 *   - アラート通知(見守る側): 表示通知(音あり、time-sensitive)
 *   - 静穏Widget更新通知: passive(見守られる側、天気/メッセージ表示)
 *   - ロケーションプッシュ ping(見守られる側): 生存確認用、表示なし
 */

async function iosDevicesFor(userId: string) {
  return db
    .select()
    .from(devices)
    .where(and(eq(devices.userId, userId), eq(devices.platform, "ios")));
}

async function androidDevicesFor(userId: string) {
  return db
    .select()
    .from(devices)
    .where(and(eq(devices.userId, userId), eq(devices.platform, "android")));
}

/** 本人確認通知(見守られる側): 「元気ですか？」 */
export async function pushCheckinRequest(
  watchedUserId: string,
  escalationId: string,
): Promise<void> {
  const ios = await iosDevicesFor(watchedUserId);
  const android = await androidDevicesFor(watchedUserId);

  await Promise.allSettled([
    ...ios.map((d) => {
      if (!d.pushToken) return Promise.resolve();
      return sendApns({
        deviceToken: d.pushToken,
        pushType: "alert",
        payload: apnsAlertPayload({
          title: "元気ですか？",
          body: "タップして「元気です」を教えてください",
          interruptionLevel: "time-sensitive",
          // category: 通知に「元気です」アクションを付ける(アプリを開かず応答可能)
          // mutable-content: NSE を起動して nse シグナル記録とキュー送信を行わせる
          category: "CHECKIN_REQUEST",
          mutableContent: true,
          data: { kind: "checkin_request", escalationId },
        }),
      });
    }),
    ...android.map((d) => {
      if (!d.pushToken) return Promise.resolve();
      return sendFcm({
        token: d.pushToken,
        notification: {
          title: "元気ですか？",
          body: "タップして「元気です」を教えてください",
        },
        data: { kind: "checkin_request", escalationId },
        highPriority: true,
      });
    }),
  ]);
}

/** アラート通知(見守る側): 「〇〇さんが応答していません」 */
export async function pushWatcherAlert(
  watcherUserId: string,
  info: {
    watchedName: string;
    escalationId: string;
    lastSignalAt: string | null;
  },
): Promise<void> {
  const ios = await iosDevicesFor(watcherUserId);
  const android = await androidDevicesFor(watcherUserId);
  const title = `${info.watchedName}さんが応答していません`;
  const body = info.lastSignalAt
    ? `最終確認: ${info.lastSignalAt}`
    : "確認をお願いします";

  await Promise.allSettled([
    ...ios.map((d) => {
      if (!d.pushToken) return Promise.resolve();
      return sendApns({
        deviceToken: d.pushToken,
        pushType: "alert",
        payload: apnsAlertPayload({
          title,
          body,
          interruptionLevel: "time-sensitive",
          data: { kind: "watcher_alert", escalationId: info.escalationId },
        }),
      });
    }),
    ...android.map((d) => {
      if (!d.pushToken) return Promise.resolve();
      return sendFcm({
        token: d.pushToken,
        notification: { title, body },
        data: { kind: "watcher_alert", escalationId: info.escalationId },
        highPriority: true,
      });
    }),
  ]);
}

/** ロケーションプッシュping(見守られる側 iOS): 表示なし、拡張を起動 */
export async function pushLocationPing(watchedUserId: string): Promise<void> {
  const ios = await iosDevicesFor(watchedUserId);
  const results = await Promise.allSettled(
    ios.map((d) => {
      // ロケーションプッシュは専用トークンが必須。APNs のデバイストークンでは
      // 送れない(startMonitoringLocationPushes が返す別物)
      const token = d.locationPushToken;
      if (!token) return Promise.resolve();
      return sendApns({
        deviceToken: token,
        pushType: "location",
        // トピックはバンドルIDそのものではなく <bundleId>.location-query。
        // 通常のトピックで送ると APNs が DeviceTokenNotForTopic を返す
        topic: `${getApnsEnv().bundleId}.location-query`,
        payload: apnsLocationPayload(),
        priority: 5,
      });
    }),
  );
  const failures = results.filter((r) => r.status === "rejected").length;
  if (failures > 0) {
    logger.warn("ロケーションプッシュping一部失敗", {
      watchedUserId,
      failures,
    });
  }
}

/** 静穏Widget更新用(passive通知、天気/メッセージ更新をトリガー) */
export async function pushWidgetRefresh(
  watchedUserId: string,
  payload: { title: string; body: string },
): Promise<void> {
  const ios = await iosDevicesFor(watchedUserId);
  const android = await androidDevicesFor(watchedUserId);

  await Promise.allSettled([
    ...ios.map((d) => {
      if (!d.pushToken) return Promise.resolve();
      return sendApns({
        deviceToken: d.pushToken,
        pushType: "alert",
        payload: apnsAlertPayload({
          title: payload.title,
          body: payload.body,
          interruptionLevel: "passive",
          mutableContent: true,
          data: { kind: "widget_refresh" },
        }),
      });
    }),
    ...android.map((d) => {
      if (!d.pushToken) return Promise.resolve();
      return sendFcm({
        token: d.pushToken,
        data: {
          kind: "widget_refresh",
          title: payload.title,
          body: payload.body,
        },
        highPriority: false,
      });
    }),
  ]);
}
