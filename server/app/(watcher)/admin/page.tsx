"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
import { authedFetcher, useAuthUser } from "../_lib/session";

interface Overview {
  users: { total: number; watchers: number; watched: number };
  activePairs: number;
  signalsLastHour: number;
  activeEscalations: {
    id: string;
    watchedId: string;
    state: string;
    startedAt: string;
    lastSignalAt: string | null;
  }[];
}

export default function AdminHome() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  const { data, error } = useSWR<Overview>(
    user ? "/api/v1/admin/overview" : null,
    authedFetcher,
    { refreshInterval: 60_000 },
  );

  if (error) return <p className="text-error">管理権限が必要です</p>;
  if (!data) return <p className="text-muted">読み込み中...</p>;

  return (
    <div>
      <h1>管理ダッシュボード</h1>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">総ユーザー</div>
          <div className="stat-value">{data.users.total}</div>
        </div>
        <div className="stat">
          <div className="stat-label">見守る側</div>
          <div className="stat-value">{data.users.watchers}</div>
        </div>
        <div className="stat">
          <div className="stat-label">見守られる側</div>
          <div className="stat-value">{data.users.watched}</div>
        </div>
        <div className="stat">
          <div className="stat-label">アクティブペア</div>
          <div className="stat-value">{data.activePairs}</div>
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">直近1時間のシグナル受信</div>
        <div className="stat-value">{data.signalsLastHour}</div>
      </div>

      <h2>アクティブなエスカレーション</h2>
      {data.activeEscalations.length === 0 ? (
        <p className="text-muted">現在アラート中のケースはありません。</p>
      ) : (
        <div className="card table-wrap" style={{ padding: "0.5rem 0.75rem" }}>
          <table className="table">
            <thead>
              <tr>
                <th>見守られる側ID</th>
                <th>状態</th>
                <th>開始</th>
                <th>最終シグナル</th>
              </tr>
            </thead>
            <tbody>
              {data.activeEscalations.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.watchedId}</td>
                  <td>{e.state}</td>
                  <td>{new Date(e.startedAt).toLocaleString("ja-JP")}</td>
                  <td>
                    {e.lastSignalAt
                      ? new Date(e.lastSignalAt).toLocaleString("ja-JP")
                      : "---"}
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
