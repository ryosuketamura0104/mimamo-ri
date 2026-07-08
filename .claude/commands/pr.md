---
description: Draft Pull Request を自動生成
---

# /pr - Draft Pull Request 作成

現在のブランチから Draft Pull Request を作成する。

## 手順

1. **現在の状態を確認**
   ```bash
   git branch --show-current
   git log origin/main..HEAD --oneline
   ```

2. **未 push の変更を確認**
   ```bash
   git status
   git log origin/$(git branch --show-current)..HEAD --oneline
   ```
   - 未コミットの変更があれば警告
   - 未 push のコミットがあれば push を促す

3. **PR タイトルと説明を生成**
   - ブランチ名とコミット履歴から適切なタイトルを生成
   - 変更範囲（server / ios / android / .claude）を Summary に明記

4. **Draft PR 作成**
   ```bash
   gh pr create --draft --base main --title "PRタイトル" --body "..."
   ```

5. **結果を報告**
   - 作成した PR の URL を表示

## PR 説明テンプレート

```markdown
## 概要
<!-- コミット履歴から要約を生成、日本語 -->

## 変更範囲
- server: ...
- ios: ...
- android: ...
- .claude: ...

## 関連 ADR / プラン
- ADR-XXXX
- Plan XX

## テスト方法
- [ ] `cd server && pnpm test` 通過
- [ ] `cd server && pnpm exec tsc --noEmit` 通過
- [ ] `cd server && pnpm run build` 通過
- [ ] iOS: `xcodebuild -project ios/Mimamori.xcodeproj -scheme Mimamori -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -configuration Debug CODE_SIGNING_ALLOWED=NO build`
- [ ] Android: `cd android && ./gradlew assembleDebug`
```

## 注意事項

- 絵文字は使用しない
- Base branch は `main`
