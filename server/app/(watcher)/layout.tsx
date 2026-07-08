import type { ReactNode } from "react";

export default function WatcherLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        maxWidth: 960,
        margin: "0 auto",
        padding: "1.5rem",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          borderBottom: "1px solid #ddd",
          paddingBottom: "0.75rem",
        }}
      >
        <a
          href="/watcher"
          style={{
            fontWeight: "bold",
            fontSize: "1.2rem",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          mimamo-ri
        </a>
        <nav>
          <a href="/watcher" style={{ marginRight: "1rem" }}>
            ダッシュボード
          </a>
          <a href="/watcher/settings">アカウント</a>
        </nav>
      </header>
      {children}
    </div>
  );
}
