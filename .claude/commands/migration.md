---
description: DB マイグレーション適用（db:push or db:migrate）
---

# /migration - データベースマイグレーション

スキーマ変更をデータベースに反映する。

## 手順

1. **現在のスキーマ状態を確認**
   ```bash
   cd server && git diff app/db/schema.ts
   ```

2. **ユーザーに確認**
   - 「開発用（db:push）と本番用（db:migrate）どちらを実行しますか？」と確認
   - 開発中は通常 `db:push` を推奨

3. **マイグレーション実行**

   **開発用（db:push）:**
   ```bash
   cd server && pnpm run db:push
   ```

   **本番用（db:migrate）:**
   ```bash
   cd server && pnpm run db:generate && pnpm run db:migrate
   ```

4. **結果を報告**
   - 成功/失敗を報告
   - 生成されたマイグレーションファイル名を表示

## 注意事項

- 破壊的変更（カラム削除等）がある場合は警告する
- `db:push` は開発環境のローカル DB のみ使用可
- ステージング / 本番へは必ず `db:generate` で生成したマイグレーションを介する
