import MimamoriKit
import UserNotifications

/// UNNotificationServiceExtension: mutable-content 付きの通知受信時にコード実行できる正規手段。
///
/// ここで行うこと:
///   1. 生存シグナル(nse)の記録と滞留分のフラッシュ
///   2. kind == widget_refresh の場合、通知ペイロードの内容を Widget の
///      共有ストアに書き込み、タイムライン再読込を要求する。
///      これにより「アプリ本体を一度も開かなくても」見守る側が送った
///      メッセージが Widget に反映される
final class NotificationService: UNNotificationServiceExtension {

    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttempt: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        self.bestAttempt = request.content.mutableCopy() as? UNMutableNotificationContent

        let kind = request.content.userInfo["kind"] as? String

        Task {
            // widget_refresh: 通知の title/body をそのまま Widget に反映。
            // 毎朝の天気 push(title「今日の天気」)は天気欄へ、それ以外はメッセージ欄へ
            if kind == "widget_refresh" {
                if request.content.title == "今日の天気" {
                    WidgetContentStore.writeWeather(line: request.content.body)
                } else {
                    WidgetContentStore.write(title: request.content.title, body: request.content.body)
                }
            }

            let unlocked = LockStateProbe.isDeviceUnlocked()
            var meta: [String: String] = [:]
            if let u = unlocked { meta["unlocked"] = u ? "true" : "false" }
            if let kind { meta["kind"] = kind }
            await SignalQueue.shared.append(Signal(type: SignalType.nse, meta: meta))
            await SignalFlusher.flush()

            if let content = self.bestAttempt {
                contentHandler(content)
            } else {
                contentHandler(request.content)
            }
        }
    }

    override func serviceExtensionTimeWillExpire() {
        if let handler = contentHandler, let content = bestAttempt {
            handler(content)
        }
    }
}
