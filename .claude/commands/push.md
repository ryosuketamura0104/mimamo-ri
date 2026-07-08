---
description: コードチェック後にユーザー確認して push
---

# /push - チェック後にプッシュ

コード品質をチェックした後、未 push のコミットをリモートにプッシュする。

## 手順

1. **変更ファイルの確認**
   ```bash
   git diff @{u}..HEAD --name-only
   ```

2. **コード品質チェック（server の変更があれば実行）**

   変更ファイルに `server/**/*.{ts,tsx}` が含まれる場合のみ実行:
   ```bash
   cd server
   pnpm run format
   pnpm run lint:f
   pnpm exec tsc --noEmit
   DATABASE_URL="postgresql://mimamori:mimamori@localhost:5432/mimamori" pnpm run build
   pnpm test
   cd ..
   ```

   - **テストは必ず実行**。失敗すれば push を中止して根本原因を直す。
   - `.md`, `.json`, `.yml`, `.yaml` のみの変更、あるいは `ios/`, `android/`, `.claude/` の変更のみならスキップして良い。

3. **未 push コミットの確認**
   ```bash
   git log @{u}..HEAD --oneline
   ```
   - 未 push のコミットがなければ「プッシュするコミットがありません」と報告して終了

4. **プッシュ先の確認**
   - `main` ブランチの場合は必ずユーザーに「main に直接プッシュしてよいですか？」と確認を取る
   - フィーチャーブランチは確認なしでプッシュしてよい

5. **プッシュ実行**
   ```bash
   git push
   ```

6. **結果を報告**
   - プッシュしたコミット数
   - リモート URL

## 注意事項

- `main` への直接 push は必ず確認を取る
- `--no-verify` などのフックスキップは使わない
