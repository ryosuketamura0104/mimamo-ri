import type { ReactNode } from "react";

export default function WatcherLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page">
      <header className="app-header">
        <a href="/watcher" className="brand">
          <span className="brand-dot" />
          mimamo-ri
        </a>
        <nav className="nav">
          <a href="/watcher" className="nav-link">
            ダッシュボード
          </a>
          <a href="/watcher/settings" className="nav-link">
            アカウント
          </a>
        </nav>
      </header>
      {children}
    </div>
  );
}
