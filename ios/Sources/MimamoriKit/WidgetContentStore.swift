import Foundation
import WidgetKit

/// Widget 表示コンテンツ(タイトル/本文)の共有ストア。
///
/// 書き込み経路が2つあるのがポイント:
///   1. アプリ本体・BGタスクがサーバーからメッセージを取得して書く(通常経路)
///   2. NSE がサーバーの widget_refresh push(mutable-content 付き)を受けた瞬間に
///      通知ペイロードの内容をそのまま書き、WidgetCenter へ再読込を要求する
///
/// 2 があることで「アプリ本体が一度も開かれなくても」見守る側が送った
/// メッセージが Widget に反映される。開かれない前提のアプリの生命線。
public enum WidgetContentStore {

    public struct Content: Sendable {
        public let title: String
        public let body: String
        public let updatedAt: Date?
    }

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: MimamoriConstants.appGroup)
    }

    /// コンテンツを書き込み、Widget のタイムライン再読込を要求する。
    public static func write(title: String, body: String) {
        guard let d = defaults else { return }
        d.set(title, forKey: MimamoriConstants.widgetTitleKey)
        d.set(body, forKey: MimamoriConstants.widgetBodyKey)
        d.set(Date().timeIntervalSince1970, forKey: MimamoriConstants.widgetUpdatedAtKey)
        reloadWidgets()
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

    /// WidgetCenter に全タイムラインの再読込を要求する。
    /// アプリ本体・app extension のどちらからでも呼べる。
    public static func reloadWidgets() {
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// サーバーから最新メッセージを取得して Widget に反映する。
    /// アプリ起動時・BGタスクから呼ぶ。失敗しても既存表示を保つだけなので握り潰す。
    public static func refreshFromServer(client: APIClient = APIClient()) async {
        guard let message = try? await client.fetchMessages(limit: 1).first else { return }
        write(title: "家族からのメッセージ", body: message.body)
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
