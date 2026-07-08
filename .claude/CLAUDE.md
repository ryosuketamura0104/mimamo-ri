# CLAUDE.md

mimamo-ri - 一人暮らし見守りアプリ（iOS Swift + Android Kotlin + Next.jsサーバー）

## リポジトリ構成（モノレポ）

| ディレクトリ | 説明 |
|-------------|------|
| `ios/` | 見守られる側/見守る側 iOSアプリ（Swift/SwiftUI）。Widget・LocationPush・NotificationService・DeviceActivityMonitor の各Extensionを含む |
| `android/` | 見守られる側/見守る側 Androidアプリ（Kotlin/Jetpack Compose） |
| `server/` | Next.js 16 + Firebase Auth + Drizzle ORM + PostgreSQL。API + 見守る側Webダッシュボード + 管理画面（../picolin-server の構成を踏襲） |

## プロダクト概要

- 見守られる側（一人暮らし）のスマホ利用シグナルをサーバーに集約し、一定時間途絶すると見守る側に通知する
- アカウントは「見守る側」「見守られる側」に分離。見守られる側1人に見守る側は複数人可
- 課金: 見守る側のみサブスク（月数百円、RevenueCat SDK）。見守られる側は無料
- ファーストリリース: Widget（天気/メッセージ）+ 生存検知 + 通知。**SOS駆けつけ機能は含めない**

## 設計の柱（詳細は .claude/adr/ を参照）

- 「端末の生存」と「人の生存」を分離して扱う
- フェイルセーフ原則: シグナル途絶＝アラート方向に倒す（見逃しより誤報を許容）
- iOSは完全パッシブ検知が不成立のため、2段階エスカレーション必須（ADR-0001）

## コミュニケーションルール

- すべての回答・コード内コメント・コミットメッセージは**日本語**
- 不確かな情報は断定せず「〜と思われます」と明示。特にiOSのバックグラウンド実行・Screen Time API等の非公開挙動は**WebSearchで裏取りしてから**回答・実装する
- 絵文字は使用しない（UI・コミットメッセージ・PR本文すべて）
- TODOコメントは `TODO: 具体的な内容` 形式
- `npm`/`npx` 禁止。`pnpm`/`pnpx` を使用（server）

## 開発コマンド

server の基本操作は `server/package.json` の scripts を参照。

| コマンド | 説明 |
|---------|------|
| `/check` | server のコード品質チェック (format → lint → tsc → build → test) |
| `/reload` | server の開発サーバー再起動 |
| `/db` | ローカル DB 操作 (SQL 実行、レコード検索など) |
| `/db-clear` | 開発 DB の全テーブルを TRUNCATE |
| `/migration` | Drizzle マイグレーション適用 |
| `/autocommit` | 変更を粒度分割してコミット |
| `/push` | チェック後に push (main は要確認) |
| `/pr` | Draft PR 生成 |
| `/review` | 現在の変更差分をレビュー |
| `/report` | 作業レポートを `.claude/reports/` に保存 |
| `/list-plans` | `.claude/plans/` のプラン一覧 |
| `/search-knowledge` | plans / reports / adr を横断検索 |
| `/save-adr` | 設計判断を ADR として保存 |

## 設計判断の記録

- 重要な設計判断は `.claude/adr/` にADRとして記録する（`/save-adr` スキル）
- 実装前に関連ADRを確認し、矛盾する変更をする場合はADRを更新する
