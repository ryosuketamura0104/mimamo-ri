"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { authedFetcher, authedRequest, useAuthUser } from "../../_lib/session";

interface Signal {
  id: string;
  type: string;
  observedAt: string;
  meta: Record<string, unknown> | null;
}

interface Escalation {
  id: string;
  state: string;
  startedAt: string;
  alertedAt: string | null;
  resolvedAt: string | null;
  lastSignalAt: string | null;
}

interface Settings {
  thresholdHours: number;
  quietStart: string;
  quietEnd: string;
  activityIntervalHours: number;
  timezone: string;
}

function fmt(dt: string | null): string {
  if (!dt) return "---";
  return new Date(dt).toLocaleString("ja-JP");
}

const SIGNAL_LABELS: Record<string, string> = {
  location_ping: "位置ping",
  unlock_probe: "ロック解除",
  screen_time: "アプリ使用",
  steps: "歩数",
  widget_probe: "Widget更新",
  shortcut: "ショートカット",
  nse: "通知拡張",
  app_open: "アプリ起動",
  checkin_tap: "本人応答",
  usage_stats: "利用履歴(Android)",
};

function SettingsForm({ watchedId }: { watchedId: string }) {
  const { data, mutate } = useSWR<{ settings: Settings }>(
    `/api/v1/watched/${watchedId}/settings`,
    authedFetcher,
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!data) return <p>設定読み込み中...</p>;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const form = new FormData(e.currentTarget);
    try {
      await authedRequest(`/api/v1/watched/${watchedId}/settings`, {
        method: "PUT",
        body: {
          thresholdHours: Number(form.get("thresholdHours")),
          quietStart: form.get("quietStart"),
          quietEnd: form.get("quietEnd"),
          activityIntervalHours: Number(form.get("activityIntervalHours")),
        },
      });
      setMsg("保存しました");
      await mutate();
    } catch (err) {
      setMsg(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const s = data.settings;
  return (
    <form
      onSubmit={submit}
      style={{ display: "grid", gap: "0.75rem", maxWidth: 480 }}
    >
      <label>
        途絶と判定する時間(1〜48時間)
        <input
          name="thresholdHours"
          type="number"
          min={1}
          max={48}
          defaultValue={s.thresholdHours}
          style={{ width: "100%", padding: "0.4rem" }}
        />
      </label>
      <label>
        静穏開始(HH:MM。この間は通知しない)
        <input
          name="quietStart"
          type="time"
          defaultValue={s.quietStart}
          style={{ width: "100%", padding: "0.4rem" }}
        />
      </label>
      <label>
        静穏終了(HH:MM)
        <input
          name="quietEnd"
          type="time"
          defaultValue={s.quietEnd}
          style={{ width: "100%", padding: "0.4rem" }}
        />
      </label>
      <label>
        シグナル区間刻み(時間)
        <select
          name="activityIntervalHours"
          defaultValue={s.activityIntervalHours}
          style={{ width: "100%", padding: "0.4rem" }}
        >
          <option value={1}>1時間</option>
          <option value={2}>2時間</option>
          <option value={3}>3時間</option>
          <option value={4}>4時間</option>
          <option value={6}>6時間</option>
          <option value={8}>8時間</option>
          <option value={12}>12時間</option>
        </select>
      </label>
      <button type="submit" disabled={busy}>
        {busy ? "保存中..." : "保存"}
      </button>
      {msg && <p style={{ margin: 0 }}>{msg}</p>}
    </form>
  );
}

function MessageForm({ watchedId }: { watchedId: string }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await authedRequest("/api/v1/messages", {
        method: "POST",
        body: { watchedId, body },
      });
      setBody("");
      setMsg("送信しました");
    } catch (err) {
      setMsg(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={200}
        placeholder="Widget に表示するメッセージ(200文字以内)"
        rows={3}
        style={{ width: "100%", padding: "0.5rem" }}
      />
      <button
        type="submit"
        disabled={busy || body.trim().length === 0}
        style={{ marginTop: "0.5rem" }}
      >
        {busy ? "送信中..." : "送信"}
      </button>
      {msg && <p style={{ margin: "0.5rem 0 0 0" }}>{msg}</p>}
    </form>
  );
}

export default function WatchedDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const [watchedId, setWatchedId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setWatchedId(p.id));
  }, [params]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const ready = !!user && !!watchedId;
  const { data: signalsData } = useSWR<{ signals: Signal[] }>(
    ready ? `/api/v1/watched/${watchedId}/signals?limit=100` : null,
    authedFetcher,
    { refreshInterval: 30_000 },
  );
  const { data: escData, mutate: refetchEsc } = useSWR<{
    escalations: Escalation[];
  }>(ready ? `/api/v1/watched/${watchedId}/escalations` : null, authedFetcher, {
    refreshInterval: 30_000,
  });

  if (!ready) return <p>読み込み中...</p>;

  const active = escData?.escalations.find(
    (e) => e.state === "confirming" || e.state === "alerted",
  );

  async function resolve(id: string) {
    if (!confirm("このアラートを解消しますか？")) return;
    await authedRequest(`/api/v1/escalations/${id}/resolve`, {
      method: "POST",
      body: {},
    });
    await refetchEsc();
  }

  return (
    <div>
      <p>
        <a href="/watcher">← ダッシュボードに戻る</a>
      </p>
      <h1>見守り対象 詳細</h1>

      {active && (
        <div
          style={{
            background: active.state === "alerted" ? "#f9d6d6" : "#fce4c9",
            padding: "1rem",
            borderRadius: 8,
            marginBottom: "1rem",
          }}
        >
          <strong>
            {active.state === "alerted" ? "アラート中" : "本人確認中"}
          </strong>
          <p style={{ margin: "0.5rem 0" }}>
            開始: {fmt(active.startedAt)} / 最終シグナル:{" "}
            {fmt(active.lastSignalAt)}
          </p>
          <button type="button" onClick={() => resolve(active.id)}>
            解消する
          </button>
        </div>
      )}

      <h2>シグナルタイムライン(直近100件)</h2>
      {signalsData?.signals.length === 0 ? (
        <p>シグナルはまだありません。</p>
      ) : (
        <ul style={{ paddingLeft: "1rem", maxHeight: 300, overflow: "auto" }}>
          {signalsData?.signals.map((s) => (
            <li key={s.id} style={{ marginBottom: "0.25rem" }}>
              <span style={{ color: "#666" }}>{fmt(s.observedAt)}</span> —{" "}
              {SIGNAL_LABELS[s.type] ?? s.type}
            </li>
          ))}
        </ul>
      )}

      <h2>エスカレーション履歴</h2>
      {escData?.escalations.length === 0 ? (
        <p>履歴はありません。</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
              <th style={{ padding: "0.4rem" }}>開始</th>
              <th style={{ padding: "0.4rem" }}>状態</th>
              <th style={{ padding: "0.4rem" }}>アラート</th>
              <th style={{ padding: "0.4rem" }}>解消</th>
            </tr>
          </thead>
          <tbody>
            {escData?.escalations.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "0.4rem" }}>{fmt(e.startedAt)}</td>
                <td style={{ padding: "0.4rem" }}>{e.state}</td>
                <td style={{ padding: "0.4rem" }}>{fmt(e.alertedAt)}</td>
                <td style={{ padding: "0.4rem" }}>{fmt(e.resolvedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Widget メッセージを送る</h2>
      <MessageForm watchedId={watchedId} />

      <h2>見守り設定</h2>
      <SettingsForm watchedId={watchedId} />
    </div>
  );
}
