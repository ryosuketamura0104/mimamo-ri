# Plan 02: iOSスパイク — DeviceActivity実機検証

## Context

ADR-0001 のシグナル層#2（Screen Time API）は公式ドキュメントが薄く、コミュニティでバグ報告が多い。
**このスパイクの結果次第でシグナル設計の比重を変える**ため、アプリ本体の実装前に必ず実施する。
シミュレータでは動作しないため実機必須。FamilyControls の開発用エンタイトルメントは Xcode の Capability 追加で即利用可（配布用のみApple申請）。

## 検証項目（優先順）

1. **基本動作**: FamilyControls承認 → 全カテゴリ選択 → `DeviceActivityMonitor` 拡張の `eventDidReachThreshold` が発火し、App Group の UserDefaults に時刻を書き込めるか
2. **しきい値の実挙動**: 15分 / 1分 / 秒単位(30秒) の3イベントを同一スケジュールに張り、発火有無・遅延を計測（しきい値最小値は公式未定義。ADR-0001参照）
3. **区間の挙動**: 6時間毎の繰り返し区間で、(a)区間跨ぎで再発火するか (b)「区間開始からの累積」セマンティクス（Apple engineer言明: developer.apple.com/forums/thread/727970）通りか
4. **継続性**: 低電力モード / 端末再起動 / アプリをスワイプ強制終了 後もイベントが発火し続けるか
5. **リソース制約**: 拡張の6MB RAM制限下で App Group 書き込み+ログが安定するか
6. **保護ファイルプローブ併用**: `FileProtectionComplete` ファイルの読み取り試行が Widget拡張・DAM拡張から意図通り動くか（ロック中に読めないこと、解除中に読めること）

## 成果物

- `ios/SpikeDeviceActivity/`: 最小アプリ（承認ボタン、監視開始ボタン、App Groupに記録された発火ログの一覧表示）+ DAM拡張 + 検証用Widget拡張
- 検証結果を本プラン末尾に追記し、ADR-0001 の該当箇所（しきい値・信頼性）を確定値で更新

## 実装メモ

- App Group: `group.com.crouton.mimamori`（仮。Bundle ID確定時に合わせる）
- スケジュール登録は `DeviceActivityCenter.startMonitoring`。intervalStart を「現在時刻直後」にする場合の即時発火に注意（累積セマンティクス）
- 記録フォーマット: `[{event, firedAt, intervalStart}]` のJSON配列をUserDefaultsに追記
- 検証は数日かけて日常利用の中でログを溜める（1日で結論を出さない）

## 判定基準

- 検証項目1,3,4が安定して通る → ADR-0001の設計通りシグナル層#2を主力に
- 発火が不安定 → シグナル層#2を「あればラッキー」に格下げし、ショートカットオートメーション（層#5）の設定ガイドを強化する方向にADR更新
