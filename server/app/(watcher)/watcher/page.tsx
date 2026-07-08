"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { authedFetcher, authedRequest, useAuthUser } from "../_lib/session";

interface WatchedItem {
  id: string;
  name: string;
  lastSignalAt: string | null;
  lastSignalType: string | null;
  escalation: { id: string; state: string; startedAt: string } | null;
}

function stateBadge(state: string) {
  const colors: Record<string, string> = {
    confirming: "#e67e22",
    alerted: "#c0392b",
    normal: "#27ae60",
  };
  const labels: Record<string, string> = {
    confirming: "確認中",
    alerted: "アラート",
    normal: "正常",
  };
  const s = state || "normal";
  return (
    <span
      style={{
        padding: "0.15rem 0.6rem",
        borderRadius: "12px",
        color: "white",
        background: colors[s] ?? "#999",
        fontSize: "0.8rem",
      }}
    >
      {labels[s] ?? s}
    </span>
  );
}

function fmt(dt: string | null): string {
  if (!dt) return "---";
  const d = new Date(dt);
  return d.toLocaleString("ja-JP");
}

function InvitationAccept({ onAccepted }: { onAccepted: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await authedRequest("/api/v1/invitations/accept", {
        method: "POST",
        body: { code: code.trim() },
      });
      setCode("");
      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{ margin: "1.5rem 0", padding: "1rem", border: "1px dashed #ccc" }}
    >
      <p style={{ margin: "0 0 0.5rem 0", fontWeight: "bold" }}>
        招待コードで見守り対象を追加
      </p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="6桁のコード"
        maxLength={6}
        style={{
          padding: "0.5rem",
          marginRight: "0.5rem",
          textTransform: "uppercase",
        }}
      />
      <button type="submit" disabled={busy || code.length !== 6}>
        {busy ? "追加中..." : "追加"}
      </button>
      {error && <p style={{ color: "red", margin: "0.5rem 0 0 0" }}>{error}</p>}
    </form>
  );
}

export default function WatcherHome() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (!authLoading && user) {
      setReady(true);
    }
  }, [authLoading, user, router]);

  const { data, error, mutate } = useSWR<{ watched: WatchedItem[] }>(
    ready ? "/api/v1/watchers/me/watched" : null,
    authedFetcher,
    { refreshInterval: 30_000 },
  );

  if (authLoading || !ready) return <p>読み込み中...</p>;
  if (error) return <p style={{ color: "red" }}>エラー: {String(error)}</p>;

  const items = data?.watched ?? [];

  return (
    <div>
      <h1>見守り対象</h1>
      <InvitationAccept onAccepted={() => mutate()} />
      {items.length === 0 ? (
        <p>
          まだ見守り対象がいません。相手のアプリで発行された招待コードを上記に入力してください。
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
              <th style={{ padding: "0.6rem" }}>名前</th>
              <th style={{ padding: "0.6rem" }}>状態</th>
              <th style={{ padding: "0.6rem" }}>最終シグナル</th>
              <th style={{ padding: "0.6rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "0.6rem" }}>{w.name}</td>
                <td style={{ padding: "0.6rem" }}>
                  {stateBadge(w.escalation?.state ?? "normal")}
                </td>
                <td style={{ padding: "0.6rem" }}>{fmt(w.lastSignalAt)}</td>
                <td style={{ padding: "0.6rem" }}>
                  <a href={`/watcher/${w.id}`}>詳細</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
