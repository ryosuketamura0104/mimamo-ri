"use client";

import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";

/**
 * Web 側 Firebase Auth クライアント初期化(SSR安全)。
 * NEXT_PUBLIC_FIREBASE_* から設定を読む。
 */

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
}

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const config = getFirebaseConfig();
  app = getApps()[0] ?? initializeApp(config);
  return app;
}

export function getFirebaseAuthClient(): Auth {
  if (auth) return auth;
  auth = getAuth(getFirebaseApp());
  return auth;
}
