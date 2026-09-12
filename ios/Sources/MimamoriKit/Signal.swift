import Foundation

/// サーバーに送信するシグナルの1件。
public struct Signal: Codable, Equatable {
    public let type: String
    public let observedAt: Date
    public let deviceId: String?
    public let meta: [String: String]?

    public init(type: String, observedAt: Date = Date(), deviceId: String? = nil, meta: [String: String]? = nil) {
        self.type = type
        self.observedAt = observedAt
        self.deviceId = deviceId
        self.meta = meta
    }
}

/// シグナル種別。サーバーの type と一致させる。
public enum SignalType {
    public static let locationPing = "location_ping"
    public static let unlockProbe = "unlock_probe"
    public static let screenTime = "screen_time"
    public static let steps = "steps"
    public static let widgetProbe = "widget_probe"
    public static let shortcut = "shortcut"
    public static let nse = "nse"
    public static let appOpen = "app_open"
    public static let checkinTap = "checkin_tap"

    // MARK: - 計測用(常駐方式の検証)

    /// 保護データが利用可能になった = ロック解除の「イベント」。
    /// unlockProbe(状態のサンプリング)と対になる概念で、捕捉率の比較に使う。
    public static let unlockEvent = "unlock_event"
    /// 保護データが利用不可になる直前 = ロックの「イベント」。
    public static let lockEvent = "lock_event"
    /// 電源未接続から接続への遷移。人が充電器に挿した可能性を示す。
    public static let chargingStart = "charging_start"
}
