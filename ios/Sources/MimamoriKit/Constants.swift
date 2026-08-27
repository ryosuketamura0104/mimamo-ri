import Foundation

/// アプリと拡張群で共通の設定値。
public enum MimamoriConstants {
    /// 全拡張と共有する App Group ID。
    public static let appGroup = "group.com.crouton.mimamori"

    /// サーバー API のベース URL。各ターゲットの Info.plist の `APIBaseURL` を優先。
    /// 拡張は自分の Info.plist を読むため、project.yml で全ターゲットに展開している。
    public static var apiBaseURL: URL {
        if let s = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String,
           let u = URL(string: s) {
            return u
        }
        return URL(string: "https://mimamori-api.example.com")!
    }

    /// バックグラウンド同期タスクの識別子。
    public static let bgSignalSyncTaskId = "com.crouton.mimamori.signal-sync"

    /// 保護ファイルプローブの相対パス(App Group 内)。
    public static let protectedProbeFilename = "protected_probe.dat"

    /// SignalQueue が滞留分を書き出す UserDefaults のキー。
    public static let signalQueueKey = "signal_queue.v1"

    /// Widget 表示コンテンツ(App Group UserDefaults)のキー。
    public static let widgetTitleKey = "widget_title"
    public static let widgetBodyKey = "widget_body"
    public static let widgetUpdatedAtKey = "widget_updated_at"

    /// 最後に「元気です」を送った時刻(App Group UserDefaults)。
    public static let lastCheckinAtKey = "last_checkin_at"

    /// APNs デバイストークンの一時保存キー。
    /// ログイン前に発行されたトークンをログイン後に登録するために使う。
    public static let pendingPushTokenKey = "pending_push_token"

    /// Widget からアプリを開く起動導線のカスタム URL スキーム。
    public static let deepLinkScheme = "mimamori"

    /// 本人確認通知(checkin_request)の通知カテゴリとアクション ID。
    /// サーバーの aps.category と一致させる。
    public static let checkinCategoryId = "CHECKIN_REQUEST"
    public static let reportAliveActionId = "REPORT_ALIVE"

    /// 「元気です」の NSUserActivity タイプ(Info.plist の NSUserActivityTypes と一致)。
    public static let reportAliveActivityType = "com.crouton.mimamori.ReportAlive"
}
