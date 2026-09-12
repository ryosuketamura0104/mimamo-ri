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

interface SentMessage {
  id: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

function fmt(dt: string | null): string {
  if (!dt) return "---";
  return new Date(dt).toLocaleString("ja-JP");
}

function fmtHM(dt: string): string {
  return new Date(dt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SIGNAL_LABELS: Record<string, string> = {
  location_ping: "位置ping",
  unlock_probe: "ロック解除(推定)",
  unlock_event: "ロック解除",
  lock_event: "ロック",
  charging_start: "充電開始",
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

  if (!data) return <p className="text-muted">設定読み込み中...</p>;

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
      className="card"
      style={{ display: "grid", gap: "0.25rem", maxWidth: 480 }}
    >
      <label className="field">
        <span className="field-label">途絶と判定する時間(1〜48時間)</span>
        <input
          className="input"
          name="thresholdHours"
          type="number"
          min={1}
          max={48}
          defaultValue={s.thresholdHours}
        />
      </label>
      <label className="field">
        <span className="field-label">静穏開始(HH:MM。この間は通知しない)</span>
        <input
          className="input"
          name="quietStart"
          type="time"
          defaultValue={s.quietStart}
        />
      </label>
      <label className="field">
        <span className="field-label">静穏終了(HH:MM)</span>
        <input
          className="input"
          name="quietEnd"
          type="time"
          defaultValue={s.quietEnd}
        />
      </label>
      <label className="field">
        <span className="field-label">シグナル区間刻み(時間)</span>
        <select
          className="input"
          name="activityIntervalHours"
          defaultValue={s.activityIntervalHours}
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
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "保存中..." : "保存"}
        </button>
      </div>
      {msg && <p style={{ margin: "0.5rem 0 0" }}>{msg}</p>}
    </form>
  );
}

function MessageForm({
  watchedId,
  onSent,
}: {
  watchedId: string;
  onSent: () => void;
}) {
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
      onSent();
    } catch (err) {
      setMsg(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <textarea
        className="input"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={200}
        placeholder="Widget に表示するメッセージ(200文字以内)"
        rows={3}
      />
      <button
        type="submit"
        className="btn btn-primary"
        disabled={busy || body.trim().length === 0}
        style={{ marginTop: "0.75rem" }}
      >
        {busy ? "送信中..." : "送信"}
      </button>
      {msg && <p style={{ margin: "0.5rem 0 0" }}>{msg}</p>}
    </form>
  );
}

function MessageSection({ watchedId }: { watchedId: string }) {
  const { data, mutate } = useSWR<{ messages: SentMessage[] }>(
    `/api/v1/watched/${watchedId}/messages`,
    authedFetcher,
    { refreshInterval: 30_000 },
  );

  return (
    <>
      <MessageForm watchedId={watchedId} onSent={() => mutate()} />
      {data &&
        (data.messages.length === 0 ? (
          <p className="text-muted">送信したメッセージはまだありません。</p>
        ) : (
          <div className="card" style={{ padding: "0.75rem 1rem" }}>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: "0.6rem",
              }}
            >
              {data.messages.map((m) => (
                <li
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, overflowWrap: "anywhere" }}>
                      {m.body}
                    </p>
                    <p className="text-small text-muted" style={{ margin: 0 }}>
                      {fmt(m.createdAt)}
                    </p>
                  </div>
                  {m.readAt ? (
                    <span className="badge badge-normal">
                      既読 {fmtHM(m.readAt)}
                    </span>
                  ) : (
                    <span className="badge">未読</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </>
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

  if (!ready) return <p className="text-muted">読み込み中...</p>;

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
      <p className="text-small">
        <a href="/watcher">← ダッシュボードに戻る</a>
      </p>
      <h1>見守り対象 詳細</h1>

      {active && (
        <div
          className={
            active.state === "alerted"
              ? "alert alert-danger"
              : "alert alert-warn"
          }
        >
          <strong>
            {active.state === "alerted" ? "アラート中" : "本人確認中"}
          </strong>
          <p style={{ margin: "0.5rem 0" }}>
            開始: {fmt(active.startedAt)} / 最終シグナル:{" "}
            {fmt(active.lastSignalAt)}
          </p>
          <button
            type="button"
            className="btn btn-tonal"
            onClick={() => resolve(active.id)}
          >
            解消する
          </button>
        </div>
      )}

      <h2>シグナルタイムライン(直近100件)</h2>
      {signalsData?.signals.length === 0 ? (
        <p className="text-muted">シグナルはまだありません。</p>
      ) : (
        <div className="card" style={{ padding: "0.5rem 1rem" }}>
          <ul className="timeline">
            {signalsData?.signals.map((s) => (
              <li key={s.id}>
                <span className="timeline-time">{fmt(s.observedAt)}</span>
                <span>{SIGNAL_LABELS[s.type] ?? s.type}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2>エスカレーション履歴</h2>
      {escData?.escalations.length === 0 ? (
        <p className="text-muted">履歴はありません。</p>
      ) : (
        <div className="card table-wrap" style={{ padding: "0.5rem 0.75rem" }}>
          <table className="table">
            <thead>
              <tr>
                <th>開始</th>
                <th>状態</th>
                <th>アラート</th>
                <th>解消</th>
              </tr>
            </thead>
            <tbody>
              {escData?.escalations.map((e) => (
                <tr key={e.id}>
                  <td>{fmt(e.startedAt)}</td>
                  <td>{e.state}</td>
                  <td>{fmt(e.alertedAt)}</td>
                  <td>{fmt(e.resolvedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Widget メッセージを送る</h2>
      <MessageSection watchedId={watchedId} />

      <h2>見守り設定</h2>
      <SettingsForm watchedId={watchedId} />
    </div>
  );
}
