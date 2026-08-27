# mimamo-ri iOS

## セットアップ

Xcode プロジェクトは XcodeGen で生成する。

```sh
brew install xcodegen
cd ios
xcodegen
open Mimamori.xcodeproj
```

### Firebase 設定

Firebase コンソールで iOS アプリ(バンドル ID `com.crouton.mimamori`)を登録し、
`GoogleService-Info.plist` をダウンロードして `ios/Resources/` に置いてからビルドする。

**ローカル開発では plist 不要**: Debug 構成は `FIREBASE_AUTH_EMULATOR_HOST`
(project.yml、既定 127.0.0.1:9099)が設定されており、plist が無い場合は
ダミー構成で Firebase Auth エミュレータに接続する。plist も emulator 設定も
無い場合はログイン画面の代わりにセットアップ案内が表示される。

ローカル一式の起動:

```sh
# DB + スキーマ
cd server && docker compose up -d postgres && pnpm db:push
# Auth エミュレータ(要 firebase.json: emulators.auth.port=9099)
pnpx firebase-tools emulators:start --only auth --project demo-mimamori
# 開発サーバー(port 3100)
pnpm dev --port 3100
```

### API 接続先

`project.yml` の `API_BASE_URL`(既定 `http://localhost:3000`)が各ターゲットの
Info.plist の `APIBaseURL` に展開される。実機から開発サーバーに繋ぐ場合は
Mac の LAN IP に変更して `xcodegen` を再実行する。

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
  - `SharedTokenStore` (App Group Keychain 経由で認証状態を共有。
    アプリ本体がログイン時に IDトークン+リフレッシュトークン+API キーを書き、
    拡張は Firebase SDK なしで Secure Token API(REST)により自力リフレッシュする)
  - `WidgetContentStore` (Widget 表示コンテンツ。アプリ本体と NSE の両方から書ける)

## 「アプリを開かれない前提」の設計

見守られる側がアプリを日常的に開かなくてもシグナルと表示が維持されるよう、
以下の経路を組み合わせている:

| 経路 | 働き |
|------|------|
| Widget タイムライン更新 | widget_probe / unlock_probe を記録し滞留分を送信 |
| Widget「元気です」ボタン | AppIntent でアプリを開かず checkin_tap 送信 |
| Widget 本体タップ | widgetURL (`mimamori://open`) でアプリ起動の導線 |
| NSE (mutable-content push) | nse シグナル記録 + widget_refresh push の内容を Widget に反映 |
| 通知アクション「元気です」 | checkin_request 通知からアプリを開かず応答 |
| BGAppRefresh | 30分間隔目安で歩数・unlock_probe 収集と送信 |
| Siri / ショートカット | App Shortcuts 経由の「元気です」 |

## 自動オフロード対策

iOS の「非使用の App を取り除く」の発動条件は非公開で、アプリ単位の除外設定も
存在しないと思われる。オフロードされると拡張ごと停止しシグナルが全途絶するため、

1. SettingsView で「設定 > App Store > 非使用のAppを取り除く」をオフにする案内を表示
2. `OffloadGuard` が最終起動から 7 / 11 / 18 日後にローカル通知を予約し、
   アプリを開く導線を作る(開かれるたびに再スケジュールされ、通常は発火しない)

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
