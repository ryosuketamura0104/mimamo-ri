---
description: 作業レポートを .claude/reports/ に保存
---

# /report - 作業レポート生成

作業完了時にレポートを作成し、`.claude/reports/` に保存する。

## 手順

1. **変更状況を確認**
   ```bash
   git status
   git diff --staged
   git log --oneline -10
   ```

2. **レポートを作成**

   ```markdown
   # <作業タイトル>

   日付: YYYY-MM-DD

   ## 概要
   何をしたかの要約（1-3 文）

   ## 変更ファイル一覧
   - server/...
   - ios/...
   - android/...
   - .claude/...

   ## 設計判断
   なぜそうしたか（判断の根拠）。関連 ADR / プランがあれば参照。

   ## 残課題・TODO
   - 未対応の項目があれば記載
   ```

3. **保存**
   - ファイル名: `.claude/reports/YYYY-MM-DD-<英語ケバブケース>.md`
   - 日付は実行日

4. **確認**
   - 保存先パスをユーザーに報告

## 注意事項

- 変更がない場合は「レポートする変更がありません」と報告
- レポートは git 管理対象（コミット可能）
- 絵文字は使用しない
