import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <p className="admin-banner">
        <span className="admin-banner-title">管理画面</span>
        <a href="/admin">ホーム</a>
        <a href="/admin/users">ユーザー</a>
      </p>
      {children}
    </div>
  );
}
