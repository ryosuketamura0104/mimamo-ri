import Foundation
import UserNotifications

/// iOS の「非使用の App を取り除く」(自動オフロード)への対策。
///
/// オフロードの発動条件は Apple 非公開で、確実な回避手段は
/// 「設定 > App Store で機能ごとオフにする」以外に存在しないと思われる
/// (アプリ単位の除外設定は無い)。見守りアプリがオフロードされると
/// 本体だけでなく NSE / Widget / DeviceActivityMonitor などの拡張も
/// まとめて動作を停止し、生存シグナルが全て途絶して誤報の原因になる。
///
/// 対策は多層で行う:
///   1. SettingsView でのユーザー説明(設定オフの案内)
///   2. Widget の起動導線(widgetURL)でアプリを開く機会を作る
///   3. この OffloadGuard: 最後にアプリが開かれてから日数が経つと、
///      段階的にローカル通知を出して「開かれた実績」を作りに行く
///
/// 通知の間隔は、オフロードが「数週間〜」で発動したという報告
/// (公式情報なし)より手前に倒して 7 / 11 / 18 日後としている。
/// アプリが開かれるたびに全て捨てて再スケジュールするので、
/// 日常的に使われている限り一切通知されない。
enum OffloadGuard {

    private static let identifiers = [
        "com.crouton.mimamori.offload-guard.1",
        "com.crouton.mimamori.offload-guard.2",
        "com.crouton.mimamori.offload-guard.3",
    ]

    private static let plans: [(id: String, days: Double, body: String)] = [
        (identifiers[0], 7, "最近アプリが開かれていません。タップして見守りが動いていることを確認しましょう"),
        (identifiers[1], 11, "アプリを長く開かないと、iOS の機能によって見守りが停止することがあります。タップして開いてください"),
        (identifiers[2], 18, "見守りを続けるため、アプリを開いてください"),
    ]

    /// アプリがフォアグラウンドになるたびに呼ぶ。
    /// 既存の予約を破棄して、今日を起点に張り直す。
    static func reschedule() {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: identifiers)
        for plan in plans {
            let content = UNMutableNotificationContent()
            content.title = "mimamo-ri"
            content.body = plan.body
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(
                timeInterval: plan.days * 24 * 60 * 60,
                repeats: false,
            )
            let request = UNNotificationRequest(identifier: plan.id, content: content, trigger: trigger)
            center.add(request)
        }
    }
}
