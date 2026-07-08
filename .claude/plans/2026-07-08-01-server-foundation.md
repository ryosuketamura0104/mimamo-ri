# Plan 01: server土台（スキーマ + シグナルAPI + 途絶判定）

## Context

`server/` に Next.js 16 + Firebase Auth + Drizzle ORM + PostgreSQL のサーバーを新規構築する。
構成・規約は `../picolin-server` を踏襲（App Router、`app/api/v1/`、Drizzle migration、docker-compose の PostgreSQL、Biome、Vitest）。

コアは ADR-0001 の途絶判定: 全シグナルを集約し、「アクティブ時間帯の累積無シグナル時間 ≥ T」でエスカレーション状態機械を回す。

## 1. プロジェクトセットアップ

- `server/` に pnpm + Next.js 16 + TypeScript を初期化。picolin-server から流用: biome.json、docker-compose.yml（postgres部分）、drizzle.config.ts、vitest.config.ts、`.env.example`
- Firebase Auth: メール+パスワード、Google Sign-In。firebase-admin でIDトークン検証（picolinの `app/api/v1/_lib/auth.ts` 相当を移植）

## 2. Drizzleスキーマ

| テーブル | 主なカラム | 備考 |
|---------|-----------|------|
| `users` | id, firebaseUid, role('watcher'\|'watched'), name, email, createdAt | 1ユーザー1ロール |
| `watch_relationships` | id, watcherId, watchedId, status('pending'\|'active'\|'revoked'), createdAt | 見守られる側1人:見守る側N人 |
| `invitations` | id, watchedId, code(6桁英数), expiresAt, usedBy | ペアリング用招待コード |
| `devices` | id, userId, platform('ios'\|'android'), pushToken, locationPushToken(iOS), appVersion, lastSeenAt | プッシュ送信先 |
| `signals` | id, watchedId, deviceId, type, observedAt, reportedAt, meta(jsonb) | typeは下記enum。observedAt=シグナル発生時刻（拡張の遅延報告があるため報告時刻と分離） |
| `watch_settings` | id, watchedId, thresholdHours(既定12), quietStart(既定'22:00'), quietEnd(既定'07:00'), activityIntervalHours(既定6), timezone | 見守る側が編集、端末に同期 |
| `escalations` | id, watchedId, state('confirming'\|'alerted'\|'resolved'), startedAt, confirmedAt, alertedAt, resolvedBy | 状態機械の履歴 |
| `messages` | id, watcherId, watchedId, body, createdAt | Widget表示用メッセージ |

`signals.type` enum: `location_ping` / `unlock_probe` / `screen_time` / `steps` / `widget_probe` / `shortcut` / `nse` / `app_open` / `checkin_tap`(本人確認応答) / `usage_stats`(Android)

- 人の生存シグナル判定用に、type毎に「人の証明か端末の証明か」の区分を定数で持つ（ADR-0001の表に従う。location_ping単体は端末のみ、unlock_probe=人(弱)等）

## 3. API（app/api/v1/）

| エンドポイント | 用途 |
|---------------|------|
| `POST /signals` | シグナル一括報告（配列受付。拡張からの遅延バッチ報告を想定、observedAt必須） |
| `POST /devices` | プッシュトークン登録・更新 |
| `GET /watched/me/settings` | 見守られる側端末が設定を同期 |
| `POST /invitations` / `POST /invitations/accept` | ペアリング |
| `GET /watchers/me/watched` | 見守る側: 見守り対象一覧+最終シグナル+エスカレーション状態 |
| `PUT /watched/:id/settings` | 見守る側: しきい値・静穏時間帯・区間刻みの変更 |
| `POST /messages` | 見守る側→Widgetメッセージ |
| `POST /escalations/:id/resolve` | アラート解消 |
| `GET /weather` | 見守られる側の地域の天気（Widget用。データソースは未定→決定後実装、それまでモック） |

- 認証: Firebase IDトークン。役割チェック（watcher/watched）をミドルウェアで
- シグナル報告は冪等（同一observedAt+type+deviceIdは重複挿入しない）

## 4. 途絶判定 + エスカレーション状態機械

cron（開発時は `POST /internal/cron/check` を手動/scheduler呼び出し。デプロイ先未定のため呼び出し方式は抽象化）:

```
for 各 active な watched:
  静穏時間帯なら skip（タイマーを進めない）
  lastHumanSignal = 人の生存シグナル(unlock_probe/screen_time/steps>0/widget_probe/shortcut/app_open/checkin_tap/usage_stats)の最新observedAt
  アクティブ時間帯の累積無シグナル時間を計算（静穏時間帯を除外して積算）
  >= T なら:
    state=confirming: 本人確認プッシュ「元気ですか？」送信、confirmedAt記録
    confirming かつ 1時間無応答: state=alerted、全watcherにアラートプッシュ（最終シグナル時刻・最終位置付き）
  checkin_tap 受信 or 任意の人シグナル受信で confirming→resolved
```

- 状態遷移はユニットテスト必須（静穏時間帯跨ぎ、タイムゾーン、複数watcher）
- 端末生存の途絶（location_ping欠測3回連続）は別枠で「端末オフラインの可能性」として見守る側に通知（アラートより弱いレベル）

## 5. プッシュ送信基盤

- APNs: token-based (p8)。通常通知 / `interruption-level: passive` / location push type / mutable-content(NSE用) を出し分けるラッパー
- FCM: firebase-admin。高優先度データメッセージ対応
- 毎時のロケーションプッシュping送信もcronから

## 6. テスト

- Vitest: 途絶判定ロジック（時刻固定で網羅）、シグナル冪等性、権限（watcherが他人のwatchedを見られない）

## 完了条件

- docker compose でローカル起動、シグナル投入→時間経過シミュレーション→エスカレーション遷移がテストで再現できる
