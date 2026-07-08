---
description: ローカル DB を操作（SQL 実行・テーブル確認・レコード検索）
---

# /db - ローカル DB 操作

開発環境の PostgreSQL に対して SQL を実行する汎用コマンド。

## 接続情報

```bash
docker exec mimamori-postgres psql -U mimamori -d mimamori
```

## 使い方

ユーザーの指示に応じて適切な SQL を実行する。

### よく使う操作例

**テーブル一覧:**
```bash
docker exec mimamori-postgres psql -U mimamori -d mimamori -c "\dt"
```

**テーブルのカラム確認:**
```bash
docker exec mimamori-postgres psql -U mimamori -d mimamori -c "\d テーブル名"
```

**レコード検索:**
```bash
docker exec mimamori-postgres psql -U mimamori -d mimamori -c "SELECT * FROM signals ORDER BY observed_at DESC LIMIT 20;"
```

**エスカレーション状況:**
```bash
docker exec mimamori-postgres psql -U mimamori -d mimamori -c \
  "SELECT id, watched_id, state, started_at, alerted_at, resolved_at FROM escalations ORDER BY started_at DESC LIMIT 20;"
```

**特定 watched の最終シグナル:**
```bash
docker exec mimamori-postgres psql -U mimamori -d mimamori -c \
  "SELECT type, observed_at FROM signals WHERE watched_id='XXX' ORDER BY observed_at DESC LIMIT 10;"
```

## 手順

1. **ユーザーの指示を解釈**
   - 自然言語の指示を適切な SQL に変換する
   - 曖昧な場合はユーザーに確認する

2. **SQL 実行**
   - `docker exec mimamori-postgres psql -U mimamori -d mimamori -c "SQL 文"` で実行
   - SELECT 文は適宜 `LIMIT` を付けて大量出力を防ぐ

3. **結果を報告**
   - 結果を見やすく整形して報告
   - エラーが発生した場合は原因を説明

## 注意事項

- 破壊的な SQL（DELETE / DROP / TRUNCATE）は必ずユーザーに確認する
- 本番 DB への実行は禁止（このコマンドはローカル専用）
