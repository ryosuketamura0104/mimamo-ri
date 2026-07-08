---
description: server のコード品質チェック（format → lint → tsc → build → test）
---

# /check - コード品質チェック

`server/` ディレクトリで以下を順番に実行してコードの品質をチェックする:

1. **Biomeでフォーマット**
   ```bash
   cd server && pnpm run format
   ```

2. **Biomeでリント（自動修正付き）**
   ```bash
   cd server && pnpm run lint:f
   ```

3. **TypeScriptの型チェック**
   ```bash
   cd server && pnpm exec tsc --noEmit
   ```

4. **ビルド確認**
   ```bash
   cd server && DATABASE_URL="postgresql://mimamori:mimamori@localhost:5432/mimamori" pnpm run build
   ```

5. **テスト**
   ```bash
   cd server && pnpm test
   ```

## 結果の報告

- すべて成功した場合: 「チェック完了: 問題ありません」と報告
- エラーがあった場合: エラー内容を表示し、修正方法を提案する

## 注意事項

- 絵文字は使用しない
- iOS / Android のチェックは別コマンドで行う（未定義）
