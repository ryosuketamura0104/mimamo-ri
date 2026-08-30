import Foundation
import MimamoriKit
import UserNotifications

/// ローカル通知の計画。
/// push(APNs)が使えない・届かない場合でも、BGタスクやアプリ起動時の
/// サーバー同期を起点に「開きたくなる/見たくなる」通知を出す。
enum NotificationPlanner {

    private static let newMessageNotifId = "com.crouton.mimamori.new-message"
    private static let morningWeatherNotifId = "com.crouton.mimamori.morning-weather"

    /// 新着メッセージのローカル通知(即時)。
    /// push が届いていれば同内容の通知が既に出ているため、
    /// refreshFromServer が「未通知の新着」と判定した場合のみ呼ぶ。
    static func notifyNewMessage(_ message: APIClient.WatchedMessage) {
        let content = UNMutableNotificationContent()
        content.title = "家族からのメッセージ"
        content.body = message.body
        content.sound = .default
        let request = UNNotificationRequest(identifier: newMessageNotifId, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
        WidgetContentStore.markNotified(messageId: message.id)
    }

    /// 毎朝7時の天気通知を「次の1回」だけ予約する。
    /// 内容は予約時点の最新天気なので、同期のたびに予約し直して鮮度を保つ。
    /// 通知タップはアプリ起動導線にもなる(オフロード対策の一部)。
    static func scheduleMorningWeather() {
        guard let line = WidgetContentStore.weatherLine else { return }

        var target = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        target.hour = 7
        target.minute = 0
        guard var fireDate = Calendar.current.date(from: target) else { return }
        if fireDate <= Date() {
            fireDate = Calendar.current.date(byAdding: .day, value: 1, to: fireDate) ?? fireDate
        }
        let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)

        let content = UNMutableNotificationContent()
        content.title = "おはようございます"
        content.body = "今日の天気: \(line)。ウィジェットで家族からのメッセージも見られます"
        content.sound = .default
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
        let request = UNNotificationRequest(identifier: morningWeatherNotifId, content: content, trigger: trigger)
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [morningWeatherNotifId])
        center.add(request)
    }
}
