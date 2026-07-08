---
description: server の開発サーバーを再起動
---

# /reload - 開発サーバー再起動

`server/` の Next.js dev サーバーを再起動する。

## 手順

1. **既存プロセスを停止**
   ```bash
   pkill -f "next dev" 2>/dev/null
   pkill -f "pnpm run dev" 2>/dev/null
   sleep 1
   lsof -ti:3000 | xargs kill -9 2>/dev/null || true
   ```

2. **Postgres が起動しているか確認**
   ```bash
   docker ps --filter name=mimamori-postgres --format '{{.Status}}'
   ```
   起動していなければ:
   ```bash
   cd server && pnpm run db:start
   ```

3. **dev サーバーを起動**
   バックグラウンドで:
   ```bash
   cd server && pnpm run dev
   ```
   （`run_in_background: true` で Bash tool 実行）

4. **起動確認**
   数秒待ってから:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
   ```
   200 系が返れば OK

## 注意事項

- iOS / Android から接続する場合、iOS シミュレータは `http://localhost:3000`、
  Android エミュレータは `http://10.0.2.2:3000` を利用する
- 実機からは `.env` の `APP_URL` を PC の LAN IP に変更する必要あり
