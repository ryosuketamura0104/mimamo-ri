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
    <div
      style={{
        maxWidth: 400,
        margin: "3rem auto",
        padding: "2rem",
        fontFamily: "sans-serif",
      }}
    >
      <h1>
        {mode === "login" ? "見守る側 ログイン" : "見守る側 アカウント作成"}
      </h1>
      <form onSubmit={onSubmit}>
        {mode === "register" && (
          <label style={{ display: "block", marginBottom: "0.75rem" }}>
            表示名
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: "100%", padding: "0.5rem" }}
            />
          </label>
        )}
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          メール
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </label>
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          パスワード(8文字以上)
          <input
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </label>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button
          type="submit"
          disabled={busy}
          style={{ padding: "0.6rem 1.2rem", width: "100%" }}
        >
          {busy
            ? "処理中..."
            : mode === "login"
              ? "ログイン"
              : "アカウント作成"}
        </button>
      </form>
      <p style={{ marginTop: "1rem" }}>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          style={{
            background: "none",
            border: "none",
            color: "blue",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          {mode === "login"
            ? "アカウントを作成する"
            : "既存アカウントでログイン"}
        </button>
      </p>
      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "#666" }}>
        見守られる側はアプリからアカウントを作成してください。
      </p>
    </div>
  );
}
