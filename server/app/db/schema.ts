import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ============================================================================
// ユーザー
// ============================================================================

/**
 * users
 * 見守る側(watcher) と 見守られる側(watched) を単一テーブルで管理。
 * role は登録時に確定し、後から変更しない前提。
 */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    firebaseUid: text("firebase_uid").notNull(),
    role: text("role").notNull(), // "watcher" | "watched"
    name: text("name").notNull(),
    email: text("email"),
    timezone: text("timezone").default("Asia/Tokyo").notNull(),
    isAdmin: boolean("is_admin").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (t) => [uniqueIndex("users_firebase_uid_key").on(t.firebaseUid)],
);

// ============================================================================
// ペアリング（見守り関係）
// ============================================================================

/**
 * watch_relationships
 * 見守られる側 1 人 : 見守る側 N 人 のリレーションを表現。
 */
export const watchRelationships = pgTable(
  "watch_relationships",
  {
    id: text("id").primaryKey(),
    watcherId: text("watcher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    watchedId: text("watched_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").default("active").notNull(), // "pending" | "active" | "revoked"
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (t) => [
    uniqueIndex("watch_rel_pair_key").on(t.watcherId, t.watchedId),
    index("watch_rel_watched_idx").on(t.watchedId),
  ],
);

/**
 * invitations
 * 見守られる側が発行する招待コード。見守る側が入力してペアリング成立。
 */
export const invitations = pgTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    watchedId: text("watched_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // 6桁英数
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedBy: text("used_by").references(() => users.id, {
      onDelete: "set null",
    }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (t) => [uniqueIndex("invitations_code_key").on(t.code)],
);

// ============================================================================
// 端末（プッシュ送信先）
// ============================================================================

export const devices = pgTable(
  "devices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(), // "ios" | "android"
    pushToken: text("push_token"), // APNs device token / FCM token
    locationPushToken: text("location_push_token"), // iOS のみ
    appVersion: text("app_version"),
    osVersion: text("os_version"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (t) => [
    index("devices_user_idx").on(t.userId),
    // push_token が来たら device を一意化（同一端末の再登録に対応）
    uniqueIndex("devices_push_token_key").on(t.pushToken),
  ],
);

// ============================================================================
// 生存シグナル
// ============================================================================

/**
 * signals
 * 端末から報告される「人 or 端末」の生存シグナル。
 * observedAt はシグナル発生時刻、reportedAt はサーバー受信時刻。
 * 拡張(NSE/DAM等)が遅延バッチで報告するため両者を分離する。
 * 冪等キー: (watchedId, deviceId, type, observedAt) で重複挿入を防止。
 * deviceId は NULL があり得るため NULLS NOT DISTINCT が必須
 * (通常の UNIQUE は NULL 同士を別値扱いし、dedup が効かなくなる)。
 *
 * type:
 *   location_ping / unlock_probe / screen_time / steps / widget_probe /
 *   shortcut / nse / app_open / checkin_tap / usage_stats
 */
export const signals = pgTable(
  "signals",
  {
    id: text("id").primaryKey(),
    watchedId: text("watched_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: text("device_id").references(() => devices.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    reportedAt: timestamp("reported_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    // 追加情報: 位置(lat/lng)、歩数、しきい値、ロック状態等
    meta: jsonb("meta").$type<Record<string, unknown>>(),
  },
  (t) => [
    unique("signals_dedup_key")
      .on(t.watchedId, t.type, t.observedAt, t.deviceId)
      .nullsNotDistinct(),
    index("signals_watched_observed_idx").on(t.watchedId, t.observedAt),
  ],
);

// ============================================================================
// 見守り設定
// ============================================================================

/**
 * watch_settings
 * 見守る側が編集し、見守られる側の端末に同期される。
 * thresholdHours: 途絶と判定する累積無シグナル時間(既定12h)
 * quietStart/End: 静穏時間帯(HH:MM)。この間は途絶タイマーを進めない
 * activityIntervalHours: DeviceActivitySchedule の区間長(既定6h)
 */
export const watchSettings = pgTable(
  "watch_settings",
  {
    id: text("id").primaryKey(),
    watchedId: text("watched_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    thresholdHours: integer("threshold_hours").default(12).notNull(),
    quietStart: text("quiet_start").default("22:00").notNull(),
    quietEnd: text("quiet_end").default("07:00").notNull(),
    activityIntervalHours: integer("activity_interval_hours")
      .default(6)
      .notNull(),
    timezone: text("timezone").default("Asia/Tokyo").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (t) => [uniqueIndex("watch_settings_watched_key").on(t.watchedId)],
);

// ============================================================================
// エスカレーション
// ============================================================================

/**
 * escalations
 * 途絶判定の状態機械履歴。1件が「normal→confirming→(alerted|resolved)」の1サイクル。
 * state:
 *   confirming: 本人確認通知を送信中(1時間タイマー)
 *   alerted:    見守る側に通知済み
 *   resolved:   本人応答 or 見守る側の解消操作で終了
 */
export const escalations = pgTable(
  "escalations",
  {
    id: text("id").primaryKey(),
    watchedId: text("watched_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    state: text("state").notNull(),
    lastSignalAt: timestamp("last_signal_at", { withTimezone: true }),
    lastSignalType: text("last_signal_type"),
    lastLat: real("last_lat"),
    lastLng: real("last_lng"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    alertedAt: timestamp("alerted_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("escalations_watched_state_idx").on(t.watchedId, t.state)],
);

// ============================================================================
// メッセージ(Widget表示用)
// ============================================================================

// ============================================================================
// サブスクリプション(RevenueCat連携)
// ============================================================================

/**
 * subscriptions
 * RevenueCat の Webhook で同期される購読状態。
 * userId は watcher のみ。1ユーザー複数エンタイトルメント想定で、複合ユニークキー。
 *
 * status: "active" | "in_grace_period" | "expired" | "cancelled"
 * store:  "app_store" | "play_store" | "stripe"
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entitlement: text("entitlement").notNull(), // 例: "watcher_premium"
    productId: text("product_id"),
    status: text("status").notNull(),
    store: text("store").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revenuecatEventId: text("revenuecat_event_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (t) => [
    uniqueIndex("subscriptions_user_entitlement_key").on(
      t.userId,
      t.entitlement,
    ),
    index("subscriptions_user_idx").on(t.userId),
  ],
);

// ============================================================================
// メッセージ(Widget表示用)
// ============================================================================

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    watcherId: text("watcher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    watchedId: text("watched_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    // 見守られる側がメッセージを確認した時刻(未読なら null)
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [index("messages_watched_created_idx").on(t.watchedId, t.createdAt)],
);

// ============================================================================
// リレーション
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  devices: many(devices),
  signalsReceived: many(signals),
  watchingRelations: many(watchRelationships, { relationName: "watcher" }),
  watchedRelations: many(watchRelationships, { relationName: "watched" }),
}));

export const watchRelationshipsRelations = relations(
  watchRelationships,
  ({ one }) => ({
    watcher: one(users, {
      fields: [watchRelationships.watcherId],
      references: [users.id],
      relationName: "watcher",
    }),
    watched: one(users, {
      fields: [watchRelationships.watchedId],
      references: [users.id],
      relationName: "watched",
    }),
  }),
);

export const signalsRelations = relations(signals, ({ one }) => ({
  watched: one(users, {
    fields: [signals.watchedId],
    references: [users.id],
  }),
  device: one(devices, {
    fields: [signals.deviceId],
    references: [devices.id],
  }),
}));

// ============================================================================
// シグナル種別の分類
// ============================================================================

/**
 * 「人の生存」を証明するシグナル種別。
 * これらのいずれかが最終シグナルなら、その時点で「人が動いた」と扱う。
 * ADR-0001 のシグナル層の分類に対応。
 */
export const HUMAN_SIGNAL_TYPES = new Set<string>([
  "unlock_probe",
  "screen_time",
  "widget_probe",
  "shortcut",
  "app_open",
  "checkin_tap",
  "usage_stats",
]);

/**
 * 歩数は 0 でない時のみ人の生存扱いにするため、専用判定を用意。
 */
export const STEPS_SIGNAL_TYPE = "steps";

/**
 * 端末生存のみを示すシグナル種別(人の生存の証明にはならない)。
 */
export const DEVICE_ONLY_SIGNAL_TYPES = new Set<string>([
  "location_ping",
  "nse",
]);
