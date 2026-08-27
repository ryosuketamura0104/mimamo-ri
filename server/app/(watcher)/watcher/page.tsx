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
  const classes: Record<string, string> = {
    confirming: "badge badge-confirming",
    alerted: "badge badge-alerted",
    normal: "badge badge-normal",
  };
  const labels: Record<string, string> = {
    confirming: "確認中",
    alerted: "アラート",
    normal: "正常",
  };
  const s = state || "normal";
  return <span className={classes[s] ?? "badge"}>{labels[s] ?? s}</span>;
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
    <form onSubmit={submit} className="card" style={{ margin: "1.25rem 0" }}>
      <p className="card-title">招待コードで見守り対象を追加</p>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="6桁のコード"
          maxLength={6}
          style={{ maxWidth: 180, textTransform: "uppercase" }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || code.length !== 6}
        >
          {busy ? "追加中..." : "追加"}
        </button>
      </div>
      {error && <p className="text-error">{error}</p>}
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

  if (authLoading || !ready) return <p className="text-muted">読み込み中...</p>;
  if (error) return <p className="text-error">エラー: {String(error)}</p>;

  const items = data?.watched ?? [];

  return (
    <div>
      <h1>見守り対象</h1>
      <InvitationAccept onAccepted={() => mutate()} />
      {items.length === 0 ? (
        <p className="text-muted">
          まだ見守り対象がいません。相手のアプリで発行された招待コードを上記に入力してください。
        </p>
      ) : (
        <div className="card table-wrap" style={{ padding: "0.5rem 0.75rem" }}>
          <table className="table">
            <thead>
              <tr>
                <th>名前</th>
                <th>状態</th>
                <th>最終シグナル</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id}>
                  <td>{w.name}</td>
                  <td>{stateBadge(w.escalation?.state ?? "normal")}</td>
                  <td>{fmt(w.lastSignalAt)}</td>
                  <td>
                    <a href={`/watcher/${w.id}`}>詳細</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
