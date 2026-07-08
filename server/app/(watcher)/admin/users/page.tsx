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
        style={{ marginBottom: "1rem" }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="名前 / メールで検索"
          style={{ padding: "0.4rem", width: "300px" }}
        />
        <button type="submit" style={{ marginLeft: "0.5rem" }}>
          検索
        </button>
      </form>
      {!data ? (
        <p>読み込み中...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
              <th style={{ padding: "0.4rem" }}>ID</th>
              <th style={{ padding: "0.4rem" }}>ロール</th>
              <th style={{ padding: "0.4rem" }}>名前</th>
              <th style={{ padding: "0.4rem" }}>メール</th>
              <th style={{ padding: "0.4rem" }}>Admin</th>
              <th style={{ padding: "0.4rem" }}>作成日</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td
                  style={{
                    padding: "0.4rem",
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                  }}
                >
                  {u.id}
                </td>
                <td style={{ padding: "0.4rem" }}>{u.role}</td>
                <td style={{ padding: "0.4rem" }}>{u.name}</td>
                <td style={{ padding: "0.4rem" }}>{u.email}</td>
                <td style={{ padding: "0.4rem" }}>{u.isAdmin ? "Yes" : ""}</td>
                <td style={{ padding: "0.4rem" }}>
                  {new Date(u.createdAt).toLocaleDateString("ja-JP")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
