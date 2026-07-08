/**
 * 環境変数を1箇所に集約。
 * 起動時に必須値の欠落を検出し、拡張は要求時のみ検証する遅延バリデーション方式。
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`環境変数 ${name} が未設定です`);
  }
  return v;
}

export function getDatabaseEnv() {
  return {
    databaseUrl: required("DATABASE_URL"),
  };
}

export function getFirebaseEnv() {
  return {
    firebaseServiceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY ?? "",
  };
}

export function getApnsEnv() {
  return {
    keyId: process.env.APNS_KEY_ID ?? "",
    teamId: process.env.APNS_TEAM_ID ?? "",
    bundleId: process.env.APNS_BUNDLE_ID ?? "com.crouton.mimamori",
    privateKey: process.env.APNS_PRIVATE_KEY ?? "",
    env: (process.env.APNS_ENV ?? "development") as
      | "development"
      | "production",
  };
}

export function getInternalCronToken(): string {
  return process.env.INTERNAL_CRON_TOKEN ?? "";
}

export function getAppUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export function getRevenueCatWebhookSecret(): string {
  return process.env.REVENUECAT_WEBHOOK_SECRET ?? "";
}

/**
 * 見守る側の無料枠(ペアリング可能人数)。この人数を超えるとサブスクを要求。
 */
export function getWatcherFreeTierPairLimit(): number {
  const v = process.env.WATCHER_FREE_PAIR_LIMIT;
  const n = v ? Number(v) : 1;
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

/**
 * サブスクリプションが必須になるエンタイトルメント名。
 */
export const WATCHER_PREMIUM_ENTITLEMENT = "watcher_premium";
