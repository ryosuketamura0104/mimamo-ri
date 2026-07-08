"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getFirebaseAuthClient } from "@/lib/firebase-client";
import { useAuthUser } from "../../_lib/session";

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  async function onSignOut() {
    await signOut(getFirebaseAuthClient());
    router.push("/login");
  }

  if (!user) return <p>読み込み中...</p>;

  return (
    <div>
      <h1>アカウント</h1>
      <dl>
        <dt>メール</dt>
        <dd>{user.email}</dd>
        <dt>ユーザーID</dt>
        <dd style={{ fontFamily: "monospace" }}>{user.uid}</dd>
      </dl>
      <button type="button" onClick={onSignOut}>
        ログアウト
      </button>
    </div>
  );
}
