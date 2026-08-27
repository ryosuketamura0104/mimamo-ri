export default function HomePage() {
  return (
    <main className="page-narrow" style={{ textAlign: "center" }}>
      <p
        className="brand"
        style={{ justifyContent: "center", display: "flex" }}
      >
        <span className="brand-dot" />
        mimamo-ri
      </p>
      <div className="card" style={{ marginTop: "1rem" }}>
        <p style={{ margin: 0 }}>一人暮らしの見守りサービス（工事中）</p>
        <p className="text-muted text-small" style={{ margin: "0.75rem 0 0" }}>
          見守る側の方は<a href="/login">ログイン</a>へ。
        </p>
      </div>
    </main>
  );
}
