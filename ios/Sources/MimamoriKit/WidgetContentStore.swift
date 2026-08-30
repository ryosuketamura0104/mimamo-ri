import Foundation
import WidgetKit

/// Widget 表示コンテンツ(メッセージ/天気/チェックイン状態)の共有ストア。
///
/// 書き込み経路:
///   1. アプリ本体・BGタスクがサーバーから取得して書く
///   2. NSE が widget_refresh push(mutable-content 付き)の内容を書く
///   3. Widget 自身が getTimeline 内で取得して書く(ホーム画面を開く=更新)
///
/// 2 と 3 があることで「アプリ本体が一度も開かれなくても」表示が更新され続ける。
public enum WidgetContentStore {

    public struct Content: Sendable {
        public let title: String
        public let body: String
        public let updatedAt: Date?
    }

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: MimamoriConstants.appGroup)
    }

    // MARK: - メッセージ表示

    /// コンテンツを書き込む。reload=true なら Widget のタイムライン再読込も要求する。
    /// (Widget の getTimeline 内から書く場合は reload=false にしないと再読込ループになる)
    public static func write(title: String, body: String, reload: Bool = true) {
        guard let d = defaults else { return }
        d.set(title, forKey: MimamoriConstants.widgetTitleKey)
        d.set(body, forKey: MimamoriConstants.widgetBodyKey)
        d.set(Date().timeIntervalSince1970, forKey: MimamoriConstants.widgetUpdatedAtKey)
        if reload { reloadWidgets() }
    }

    public static func read() -> Content {
        let d = defaults
        let updatedAt: Date?
        if let t = d?.object(forKey: MimamoriConstants.widgetUpdatedAtKey) as? Double {
            updatedAt = Date(timeIntervalSince1970: t)
        } else {
            updatedAt = nil
        }
        return Content(
            title: d?.string(forKey: MimamoriConstants.widgetTitleKey) ?? "mimamo-ri",
            body: d?.string(forKey: MimamoriConstants.widgetBodyKey) ?? "今日も元気に過ごしましょう",
            updatedAt: updatedAt,
        )
    }

    // MARK: - 天気

    public static var weatherLine: String? {
        defaults?.string(forKey: MimamoriConstants.weatherLineKey)
    }

    public static func writeWeather(line: String, reload: Bool = true) {
        defaults?.set(line, forKey: MimamoriConstants.weatherLineKey)
        defaults?.set(Date().timeIntervalSince1970, forKey: MimamoriConstants.weatherUpdatedAtKey)
        if reload { reloadWidgets() }
    }

    // MARK: - 最新メッセージの既読管理

    public static var latestMessageId: String? {
        defaults?.string(forKey: MimamoriConstants.latestMessageIdKey)
    }

    public static var latestMessageRead: Bool {
        defaults?.bool(forKey: MimamoriConstants.latestMessageReadKey) ?? true
    }

    public static func markLatestMessageRead(reload: Bool = true) {
        defaults?.set(true, forKey: MimamoriConstants.latestMessageReadKey)
        if reload { reloadWidgets() }
    }

    /// この id のメッセージについてローカル通知を出したことを記録する(重複通知防止)。
    public static func markNotified(messageId: String) {
        defaults?.set(messageId, forKey: MimamoriConstants.notifiedMessageIdKey)
    }

    // MARK: - 位置(天気取得用)

    /// 最後に取得できた位置。未取得なら東京駅付近。
    public static var lastCoordinates: (lat: Double, lng: Double) {
        guard let d = defaults,
              let lat = d.object(forKey: MimamoriConstants.lastLatitudeKey) as? Double,
              let lng = d.object(forKey: MimamoriConstants.lastLongitudeKey) as? Double else {
            return (35.6812, 139.7671)
        }
        return (lat, lng)
    }

    public static func saveCoordinates(lat: Double, lng: Double) {
        defaults?.set(lat, forKey: MimamoriConstants.lastLatitudeKey)
        defaults?.set(lng, forKey: MimamoriConstants.lastLongitudeKey)
    }

    // MARK: - サーバーからの取得

    /// サーバーから最新メッセージと天気を取得して反映する。
    /// - Parameter reload: Widget 再読込を要求するか(getTimeline 内からは false)
    /// - Returns: まだローカル通知を出していない未読の新着メッセージ(あれば)
    @discardableResult
    public static func refreshFromServer(client: APIClient = APIClient(), reload: Bool = true) async -> APIClient.WatchedMessage? {
        var newMessage: APIClient.WatchedMessage?

        if let message = try? await client.fetchMessages(limit: 1).first {
            write(title: "家族からのメッセージ", body: message.body, reload: false)
            defaults?.set(message.id, forKey: MimamoriConstants.latestMessageIdKey)
            defaults?.set(message.readAt != nil, forKey: MimamoriConstants.latestMessageReadKey)
            let notified = defaults?.string(forKey: MimamoriConstants.notifiedMessageIdKey)
            if notified != message.id && message.readAt == nil {
                newMessage = message
            }
        }

        let coords = lastCoordinates
        if let weather = try? await client.fetchWeather(lat: coords.lat, lng: coords.lng) {
            writeWeather(line: weather.line, reload: false)
        }

        if reload { reloadWidgets() }
        return newMessage
    }

    // MARK: - チェックイン

    /// WidgetCenter に全タイムラインの再読込を要求する。
    /// アプリ本体・app extension のどちらからでも呼べる。
    public static func reloadWidgets() {
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// 最後に「元気です」を送った時刻の記録(Widget 表示用)。
    public static func recordCheckin() {
        defaults?.set(Date().timeIntervalSince1970, forKey: MimamoriConstants.lastCheckinAtKey)
        reloadWidgets()
    }

    public static var lastCheckinAt: Date? {
        guard let t = defaults?.object(forKey: MimamoriConstants.lastCheckinAtKey) as? Double else { return nil }
        return Date(timeIntervalSince1970: t)
    }
}
