# ADR-0002: 「アプリを開かれない前提」のクライアント実装方式

## ステータス
承認 (2026-08-27)

## コンテキスト

見守られる側(高齢者)はアプリを日常的に開かない前提で設計する(iOSDC Japan 2026 LT「アプリを開かれない前提で作る高齢者見守りアプリ」の主題)。このとき iOS クライアントには2つの課題がある。

1. **認証の維持**: Firebase の IDトークンは約1時間で失効する。アプリ本体が開かれなければ SDK によるトークン更新も走らず、拡張(NSE/Widget/LocationPush)からの API 送信が全滅する
2. **表示の更新**: Widget のメッセージ表示はアプリ本体がサーバーから取得して書くのが通常経路だが、開かれなければ永遠に更新されない
3. **自動オフロード**: iOS の「非使用のAppを取り除く」の発動条件は Apple 非公開(開発者フォーラムで数年未回答)。アプリ単位の除外設定は存在せず、確実な回避は「設定 > App Store で全体オフ」のみ。オフロードされると拡張ごと停止し、シグナル全途絶=誤報の原因になる

## 決定

### 1. 拡張の認証は共有 Keychain + Secure Token API(REST)で自立させる

- アプリ本体はログイン時・フォアグラウンド時に IDトークン + リフレッシュトークン + Firebase API キーを App Group Keychain(`SharedTokenStore`)へ書き出す
- 拡張は `SharedKeychainTokenProvider` が期限切れ前に `securetoken.googleapis.com/v1/token` を直接叩いてリフレッシュし、書き戻す
- これにより拡張プロセスに Firebase SDK を載せずに済み(バイナリサイズ・6MB RAM 制限対策)、アプリ本体が長期間開かれなくても認証が維持される

### 2. Widget の表示更新は NSE を配信経路にする

- サーバーの widget_refresh push は `mutable-content: 1` + `interruption-level: passive`
- NSE が通知の title/body をそのまま `WidgetContentStore`(App Group)に書き、`WidgetCenter.reloadAllTimelines()` を呼ぶ
- つまり「見守る側がメッセージ投稿 → push → NSE → Widget 反映」がアプリ本体を経由せず成立する
- アプリ本体・BGAppRefresh からの GET /api/v1/messages による更新は補助経路として併存

### 3. checkin_request 通知は開かずに応答できるようにする

- サーバーは `category: CHECKIN_REQUEST` + `mutable-content` を付与
- アプリは `UNNotificationAction`(options 空 = バックグラウンド実行)で「元気です」アクションを登録し、タップ/アクションいずれも checkin_tap シグナルとして送信

### 4. オフロード対策は「説明 + 導線 + 保険通知」の多層

- SettingsView で「非使用のAppを取り除く」をオフにする案内(確実なのはこれだけ)
- Widget 本体タップを `widgetURL`(mimamori:// スキーム)でアプリ起動導線にする
- `OffloadGuard`: フォアグラウンド毎に最終起動起点でローカル通知を 7/11/18 日後に張り直す。日常的に開かれていれば発火しない。発動時期の数値は非公式報告(12日〜数週間)より手前に倒した推定値

## 影響

- 拡張が Secure Token API を直接叩くため、Firebase のトークンローテーション仕様変更には追従が必要
- `WidgetCenter` を NSE から呼ぶ挙動は広く使われているが公式ドキュメントの明言は薄く、実機検証項目に含める
- OffloadGuard の通知間隔はオフロード実測データが取れたら調整する(スパイク検証項目)

## 参考

- iOSDC Japan 2026 プロポーザル: https://fortee.jp/iosdc-japan-2026/proposal/b531cfc0-c4ee-4a4e-b435-8fcab3e73e98
- オフロード条件が非公開である件: https://developer.apple.com/forums/thread/98359
