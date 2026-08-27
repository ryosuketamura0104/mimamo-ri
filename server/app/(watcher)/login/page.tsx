"use client";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getFirebaseAuthClient } from "@/lib/firebase-client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const auth = getFirebaseAuthClient();
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        // サーバー側にユーザー登録
        const token = await cred.user.getIdToken();
        const res = await fetch("/api/v1/users/register", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role: "watcher", name, email }),
        });
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(`登録失敗: ${msg}`);
        }
      }
      router.push("/watcher");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-narrow">
      <p className="brand" style={{ display: "flex", alignItems: "center" }}>
        <span className="brand-dot" />
        mimamo-ri
      </p>
      <div className="card" style={{ marginTop: "0.75rem" }}>
        <h1 style={{ fontSize: "1.2rem" }}>
          {mode === "login" ? "見守る側 ログイン" : "見守る側 アカウント作成"}
        </h1>
        <form onSubmit={onSubmit}>
          {mode === "register" && (
            <label className="field">
              <span className="field-label">表示名</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          )}
          <label className="field">
            <span className="field-label">メール</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">パスワード(8文字以上)</span>
            <input
              className="input"
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="text-error">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary btn-block"
            style={{ marginTop: "0.5rem" }}
          >
            {busy
              ? "処理中..."
              : mode === "login"
                ? "ログイン"
                : "アカウント作成"}
          </button>
        </form>
        <p style={{ marginTop: "1rem", marginBottom: 0 }}>
          <button
            type="button"
            className="btn-text"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login"
              ? "アカウントを作成する"
              : "既存アカウントでログイン"}
          </button>
        </p>
      </div>
      <p className="text-muted text-small" style={{ marginTop: "1.5rem" }}>
        見守られる側はアプリからアカウントを作成してください。
      </p>
    </div>
  );
}
