---
description: 開発 DB の全テーブルを TRUNCATE
---

# /db-clear - 開発 DB クリア

開発環境の DB を空にする。マイグレーション自体は残る。

## 手順

1. **確認**
   - ローカル環境であることを確認（`docker exec mimamori-postgres` が通ることを確認）
   - ユーザーに「本当に全データを削除して良いか」確認する

2. **全テーブルを CASCADE で TRUNCATE**

   外部キー制約を考慮した順序、または CASCADE で一括削除:

   ```bash
   docker exec mimamori-postgres psql -U mimamori -d mimamori -c "
     TRUNCATE TABLE messages CASCADE;
     TRUNCATE TABLE escalations CASCADE;
     TRUNCATE TABLE signals CASCADE;
     TRUNCATE TABLE devices CASCADE;
     TRUNCATE TABLE watch_settings CASCADE;
     TRUNCATE TABLE invitations CASCADE;
     TRUNCATE TABLE watch_relationships CASCADE;
     TRUNCATE TABLE subscriptions CASCADE;
     TRUNCATE TABLE users CASCADE;
   "
   ```

3. **結果を報告**
   - クリア完了を報告
   - 各テーブルの件数が 0 になったことを `SELECT count(*)` で確認

## 注意事項

- 開発環境専用（本番では使用禁止）
- 全データが削除される（復元不可）
- スキーマ自体は削除しない。スキーマまで初期化したい場合は `pnpm run db:push --force`
