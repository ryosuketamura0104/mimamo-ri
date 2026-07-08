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

  if (error) return <p style={{ color: "red" }}>管理権限が必要です</p>;
  if (!data) return <p>読み込み中...</p>;

  return (
    <div>
      <h1>管理ダッシュボード</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          margin: "1rem 0",
        }}
      >
        <div style={box}>
          <div style={label}>総ユーザー</div>
          <div style={value}>{data.users.total}</div>
        </div>
        <div style={box}>
          <div style={label}>見守る側</div>
          <div style={value}>{data.users.watchers}</div>
        </div>
        <div style={box}>
          <div style={label}>見守られる側</div>
          <div style={value}>{data.users.watched}</div>
        </div>
        <div style={box}>
          <div style={label}>アクティブペア</div>
          <div style={value}>{data.activePairs}</div>
        </div>
      </div>
      <div style={box}>
        <div style={label}>直近1時間のシグナル受信</div>
        <div style={value}>{data.signalsLastHour}</div>
      </div>

      <h2>アクティブなエスカレーション</h2>
      {data.activeEscalations.length === 0 ? (
        <p>現在アラート中のケースはありません。</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
              <th style={{ padding: "0.4rem" }}>見守られる側ID</th>
              <th style={{ padding: "0.4rem" }}>状態</th>
              <th style={{ padding: "0.4rem" }}>開始</th>
              <th style={{ padding: "0.4rem" }}>最終シグナル</th>
            </tr>
          </thead>
          <tbody>
            {data.activeEscalations.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "0.4rem", fontFamily: "monospace" }}>
                  {e.watchedId}
                </td>
                <td style={{ padding: "0.4rem" }}>{e.state}</td>
                <td style={{ padding: "0.4rem" }}>
                  {new Date(e.startedAt).toLocaleString("ja-JP")}
                </td>
                <td style={{ padding: "0.4rem" }}>
                  {e.lastSignalAt
                    ? new Date(e.lastSignalAt).toLocaleString("ja-JP")
                    : "---"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const box: React.CSSProperties = {
  padding: "1rem",
  background: "#f5f5f5",
  borderRadius: 6,
};
const label: React.CSSProperties = { fontSize: "0.85rem", color: "#666" };
const value: React.CSSProperties = { fontSize: "1.5rem", fontWeight: "bold" };
