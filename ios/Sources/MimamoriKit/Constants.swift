import Foundation

/// アプリと拡張群で共通の設定値。
public enum MimamoriConstants {
    /// 全拡張と共有する App Group ID。
    public static let appGroup = "group.com.crouton.mimamori"

    /// サーバー API のベース URL。開発時は Info.plist の `APIBaseURL` を優先。
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
}
