# mimamo-ri iOS

## セットアップ

Xcode プロジェクトは XcodeGen で生成する。

```sh
brew install xcodegen
cd ios
xcodegen
open Mimamori.xcodeproj
```

`project.yml` にはターゲット構成が全て記載されている:

- **Mimamori** (App、iOS 17+)
- **MimamoriKit** (共有 Framework)
- **WidgetExtension** (WidgetKit + AppIntent「元気です」)
- **LocationPushExtension** (CLLocationPushServiceExtension)
- **NotificationServiceExtension** (通知受信時に生存シグナル報告)
- **DeviceActivityMonitorExtension** (Screen Time API)

## 共有基盤

- **App Group**: `group.com.crouton.mimamori`
  - `SignalQueue` (App Group UserDefaults 経由でシグナル滞留)
  - `LockStateProbe` (保護ファイルでロック状態判定)
  - `SharedTokenStore` (App Group Keychain 経由で IDトークン共有)

## エンタイトルメント

- **Application Groups**: 全ターゲットに必須
- **APNs**: 開発 (`aps-environment: development`)、リリース時に `production` へ切替
- **Family Controls**: 開発時は Xcode Capability で即利用可、配布時は Apple 申請
- **Location Push**: `com.apple.developer.location.push` は Apple 申請済み後に有効化
- **Notification Filtering** は申請中は取得せず、代替として `interruption-level: passive` を利用

## スパイク検証 (Plan 02)

`DeviceActivityMonitorExtension` の `usage_1min` / `usage_15min` イベントを同時に張り、
実機で1〜数日運用して発火頻度・遅延・区間跨ぎの挙動を観測する。

観測データは App Group UserDefaults の `signal_queue.v1` に蓄積され、
アプリ本体で確認できる。
