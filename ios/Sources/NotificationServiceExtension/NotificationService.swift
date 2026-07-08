import MimamoriKit
import UserNotifications

/// UNNotificationServiceExtension: 通知受信時にコード実行できる正規手段。
/// 通知そのものは表示するが、この隙に生存シグナル(nse)を記録し、
/// SignalQueue の滞留分もサーバーに送る。
final class NotificationService: UNNotificationServiceExtension {

    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttempt: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        self.bestAttempt = request.content.mutableCopy() as? UNMutableNotificationContent

        Task {
            let unlocked = LockStateProbe.isDeviceUnlocked()
            var meta: [String: String] = [:]
            if let u = unlocked { meta["unlocked"] = u ? "true" : "false" }
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
