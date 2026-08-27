# mimamo-ri Android

## セットアップ

1. Android Studio Ladybug 以降を用意
2. `local.properties` に `sdk.dir=/path/to/Android/sdk` を設定
3. Firebase コンソールで `com.crouton.mimamori` を追加し、`google-services.json` を `app/` 直下に配置
   (ローカル開発では下記の Auth エミュレータ用ダミーで可)

## ローカル開発(Firebase Auth エミュレータ)

実プロジェクト不要で動かせる。`google-services.json` はダミー値
(project_id: demo-mimamori、mobilesdk_app_id は `1:<数字>:android:<16進>` 形式)で良い。

```sh
# サーバー(:3100)と Auth エミュレータ(:9099)をホストで起動した上で
./gradlew :app:assembleDebug -PAPI_BASE_URL=http://10.0.2.2:3100 -PAUTH_EMULATOR_HOST=10.0.2.2:9099
```

`AUTH_EMULATOR_HOST` が空(既定)なら本番 Firebase に接続する。
10.0.2.2 はエミュレータから見たホストの loopback。FCM 送信はエミュレータ非対応。

## サーバー API のベース URL

`local.properties` または Gradle プロパティで指定できる:

```
API_BASE_URL=https://api.example.com
```

エミュレータからローカルサーバー(`localhost:3000`)に接続する場合は既定の `http://10.0.2.2:3000` のままで良い。

## 使用状況アクセス権限

`PACKAGE_USAGE_STATS` は特別権限のため、初回起動時にホーム画面から
「使用状況アクセスの設定を開く」ボタンで設定画面へ誘導する。

## Doze 対策

FCM 高優先度データメッセージ + 電池最適化除外の案内で対応。
シグナル同期は WorkManager の 30 分周期で走る。

## 主要ディレクトリ

```
app/src/main/java/com/crouton/mimamori/
├── MimamoriApp.kt          // Application (通知チャンネル + WorkManager)
├── MainActivity.kt         // 起動 Activity
├── api/                    // Ktor ベース API クライアント + シリアライズ DTO
├── auth/                   // Firebase Auth 抽象
├── signal/                 // UsageStatsCollector
├── work/                   // UsageSyncWorker
├── widget/                 // Glance Widget
├── receiver/               // BootReceiver, FCM サービス
└── ui/screen/              // Compose UI (Login, Home)
```
