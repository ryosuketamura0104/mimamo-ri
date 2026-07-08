# Plan 06: 課金（RevenueCat サブスクリプション）

## Context

課金するのは**見守る側のみ**（見守られる側は無料）。月数百円のサブスク。RevenueCat SDK を採用（要件）。
RevenueCatがIAP（App Store / Google Play）のレシート検証・状態管理を肩代わりし、サーバーはWebhookで購読状態を同期する。

## 1. 商品設計（実装前に確定させる）

- 単一プラン想定（例: `watcher_monthly` ¥300/月）。見守り対象人数での段階制にするかは未決 → 実装前にユーザーに確認
- 無料トライアルの有無も未決 → 確認
- エンタイトルメント名: `watcher_premium`
- 未課金watcherの制限範囲を確定する（例: ペアリング1人まで無料 or 全機能7日間 → 確認必須）

## 2. RevenueCat セットアップ

- プロジェクト作成、App Store Connect / Google Play Console のAPIキー接続
- アプリユーザーID = FirebaseのUID（`logIn(firebaseUid)`）で突合
- Webも課金導線に含める場合はRevenueCat Web Billing（Stripe連携）を検討 → 要確認。ファーストリリースはアプリ内IAPのみでも可

## 3. クライアント実装

- iOS: purchases-ios (SPM)。ペイウォール画面（watcherロールのみ表示）、購入・リストア
- Android: purchases-android。同上
- 起動時に `getCustomerInfo` でエンタイトルメント確認 → 機能ゲート

## 4. サーバー実装

- `POST /api/webhooks/revenuecat`: Authorizationヘッダ検証。INITIAL_PURCHASE / RENEWAL / CANCELLATION / EXPIRATION を処理し `subscriptions` テーブル（userId, entitlement, status, expiresAt, store）を更新
- APIの機能ゲート: watcher向けAPIで購読状態をチェック（例: 2人目以降のペアリング作成）
- 管理画面に購読状況ビュー（Plan 05に追記）

## 5. 検証

- Sandbox（App Store）/ ライセンステスト（Play）で購入→Webhook→DB反映→機能解放の一連
- 解約・期限切れで機能が制限されること、見守り自体（watchedの安全）は**課金切れでも即座に止めない**猶予設計（例: 7日間の猶予期間）→ 要確認

## 未決事項（実装着手前にユーザーに確認）

1. 価格と無料枠の範囲
2. トライアル有無
3. Web課金（Stripe）を初回から入れるか
4. 課金切れ時の見守り継続猶予
