import type { App } from "firebase-admin/app";
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseEnv } from "./env";
import { logger } from "./logger";

let firebaseApp: App | null = null;
let initialized = false;

/**
 * Firebase Admin SDK をシングルトンで初期化。
 * FIREBASE_SERVICE_ACCOUNT_KEY が未設定の場合は null を返し、認証・プッシュ機能は無効化される。
 */
function initializeFirebaseAdmin(): App | null {
  if (initialized) return firebaseApp;
  initialized = true;

  // ローカル開発: Auth エミュレータ使用時はサービスアカウント不要で
  // ID トークン検証ができる(FCM 送信は不可)
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getApps, initializeApp } = require("firebase-admin/app");
    const existing = getApps();
    firebaseApp =
      existing[0] ??
      initializeApp({
        projectId:
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-mimamori",
      });
    logger.info(
      "Firebase Admin SDK を Auth エミュレータモードで初期化しました",
    );
    return firebaseApp;
  }

  const { firebaseServiceAccountKey } = getFirebaseEnv();
  if (!firebaseServiceAccountKey) {
    logger.warn(
      "FIREBASE_SERVICE_ACCOUNT_KEY が未設定のため、Firebase 機能は無効です",
    );
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { cert, getApps, initializeApp } = require("firebase-admin/app");
    const existing = getApps();
    if (existing.length > 0) {
      firebaseApp = existing[0];
      return firebaseApp;
    }
    const serviceAccount = JSON.parse(firebaseServiceAccountKey);
    firebaseApp = initializeApp({ credential: cert(serviceAccount) });
    logger.info("Firebase Admin SDK を初期化しました");
    return firebaseApp;
  } catch (error) {
    logger.error("Firebase Admin SDK の初期化に失敗しました", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function getFirebaseAuth(): Auth | null {
  const app = initializeFirebaseAdmin();
  if (!app) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getAuth } = require("firebase-admin/auth");
  return getAuth(app);
}

export function getFirebaseMessaging() {
  const app = initializeFirebaseAdmin();
  if (!app) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getMessaging } = require("firebase-admin/messaging");
  return getMessaging(app);
}

export async function verifyIdToken(
  idToken: string,
): Promise<DecodedIdToken | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  try {
    return await auth.verifyIdToken(idToken);
  } catch (error) {
    logger.warn("IDトークン検証失敗", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
