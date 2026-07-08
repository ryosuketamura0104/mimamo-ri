import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <p
        style={{
          background: "#333",
          color: "white",
          padding: "0.5rem 1rem",
          borderRadius: 4,
        }}
      >
        管理画面{" "}
        <a
          href="/admin"
          style={{ color: "white", marginRight: "1rem", marginLeft: "1rem" }}
        >
          ホーム
        </a>
        <a href="/admin/users" style={{ color: "white", marginRight: "1rem" }}>
          ユーザー
        </a>
      </p>
      {children}
    </div>
  );
}
