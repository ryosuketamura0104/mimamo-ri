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

  if (!user) return <p className="text-muted">読み込み中...</p>;

  return (
    <div>
      <h1>アカウント</h1>
      <div className="card" style={{ maxWidth: 480 }}>
        <dl className="dl">
          <dt>メール</dt>
          <dd>{user.email}</dd>
          <dt>ユーザーID</dt>
          <dd className="mono">{user.uid}</dd>
        </dl>
        <button type="button" className="btn btn-tonal" onClick={onSignOut}>
          ログアウト
        </button>
      </div>
    </div>
  );
}
