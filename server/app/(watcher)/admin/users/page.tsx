"use client";

import { useState } from "react";
import useSWR from "swr";
import { authedFetcher } from "../../_lib/session";

interface AdminUser {
  id: string;
  role: string;
  name: string;
  email: string | null;
  isAdmin: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const { data } = useSWR<{ users: AdminUser[] }>(
    `/api/v1/admin/users?q=${encodeURIComponent(applied)}`,
    authedFetcher,
  );

  return (
    <div>
      <h1>ユーザー</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(q);
        }}
        style={{
          marginBottom: "1rem",
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
        }}
      >
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="名前 / メールで検索"
          style={{ maxWidth: 300 }}
        />
        <button type="submit" className="btn btn-primary">
          検索
        </button>
      </form>
      {!data ? (
        <p className="text-muted">読み込み中...</p>
      ) : (
        <div className="card table-wrap" style={{ padding: "0.5rem 0.75rem" }}>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>ロール</th>
                <th>名前</th>
                <th>メール</th>
                <th>Admin</th>
                <th>作成日</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td className="mono">{u.id}</td>
                  <td>{u.role}</td>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    {u.isAdmin ? (
                      <span className="badge badge-normal">Yes</span>
                    ) : (
                      ""
                    )}
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString("ja-JP")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
