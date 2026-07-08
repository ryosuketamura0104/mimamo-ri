import Foundation

/// 拡張がネットワーク不可 or 時間制限のため、収集したシグナルを App Group の
/// UserDefaults に一時滞留させる。
/// アプリ本体・ロケーションプッシュ拡張・NSE 等が呼ばれた時にまとめてフラッシュする。
public actor SignalQueue {
    public static let shared = SignalQueue()

    private let defaults: UserDefaults?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {
        self.defaults = UserDefaults(suiteName: MimamoriConstants.appGroup)
        self.encoder.dateEncodingStrategy = .iso8601
        self.decoder.dateDecodingStrategy = .iso8601
    }

    public func append(_ signal: Signal) {
        var current = load()
        current.append(signal)
        save(current)
    }

    public func appendMany(_ signals: [Signal]) {
        var current = load()
        current.append(contentsOf: signals)
        save(current)
    }

    /// 現在滞留中のシグナルを取り出し、キューをクリアする。
    /// フラッシュ失敗時は呼び出し側で `appendMany` で戻す想定。
    public func drain() -> [Signal] {
        let current = load()
        save([])
        return current
    }

    public func peek() -> [Signal] {
        return load()
    }

    private func load() -> [Signal] {
        guard let data = defaults?.data(forKey: MimamoriConstants.signalQueueKey) else { return [] }
        return (try? decoder.decode([Signal].self, from: data)) ?? []
    }

    private func save(_ signals: [Signal]) {
        // 上限を設けて古い物から捨てる(拡張の6MB制限保護)
        let capped = signals.count > 500 ? Array(signals.suffix(500)) : signals
        let data = (try? encoder.encode(capped)) ?? Data()
        defaults?.set(data, forKey: MimamoriConstants.signalQueueKey)
    }
}
