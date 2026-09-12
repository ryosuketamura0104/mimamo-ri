import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// 「アプリを開かれない前提」の各経路が実際にどれだけ機能しているかを実測するための計測基盤。
///
/// 目的は2つ:
///   1. Widget の getTimeline が現実に何回・どんな間隔で走るのかを記録する
///      (更新予算は OS 任せなので、実機で数日回さないと分からない)
///   2. 発火しなかった/意味をなさなかった状況の手がかりを残す
///      (低電力モード・ロック中・電池残量は Widget 更新頻度に効くと思われる)
///
/// 併せて充電状態の遷移(unplugged → charging)も検出する。充電「状態」は端末の生存だが、
/// 充電を「開始した」ことは人が挿した可能性を示すため、両者を区別して記録する。
public enum DeviceTelemetry {

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: MimamoriConstants.appGroup)
    }

    // MARK: - 端末コンディションのスナップショット

    public struct Snapshot: Sendable {
        public let batteryState: String
        public let batteryLevel: Float
        public let lowPowerMode: Bool
        public let locked: Bool?
    }

    /// 現在の端末コンディションを読む。
    /// UIDevice は Swift では MainActor 隔離のため、呼び出し側で MainActor を確保すること。
    @MainActor
    public static func snapshot() -> Snapshot {
        #if canImport(UIKit)
        // バッテリー監視は既定 false。プロセスごとに有効化が必要。
        if !UIDevice.current.isBatteryMonitoringEnabled {
            UIDevice.current.isBatteryMonitoringEnabled = true
        }
        let state: String
        switch UIDevice.current.batteryState {
        case .charging: state = "charging"
        case .full: state = "full"
        case .unplugged: state = "unplugged"
        default: state = "unknown"
        }
        let level = UIDevice.current.batteryLevel
        #else
        let state = "unknown"
        let level: Float = -1
        #endif
        return Snapshot(
            batteryState: state,
            batteryLevel: level,
            lowPowerMode: ProcessInfo.processInfo.isLowPowerModeEnabled,
            locked: LockStateProbe.isDeviceUnlocked().map { !$0 },
        )
    }

    /// スナップショットを meta 辞書に落とす(シグナルに添付する用)。
    /// batteryLevel は iOS 17 以降 5% 刻みに丸められるため、そのまま記録して後で解釈する。
    public static func metaFields(from s: Snapshot) -> [String: String] {
        var meta: [String: String] = [
            "battery": s.batteryState,
            "low_power": s.lowPowerMode ? "true" : "false",
        ]
        if s.batteryLevel >= 0 {
            meta["level"] = String(format: "%.2f", s.batteryLevel)
        }
        if let locked = s.locked {
            meta["locked"] = locked ? "true" : "false"
        }
        return meta
    }

    // MARK: - Widget 発火間隔

    /// 前回の Widget 発火からの経過秒数を返し、今回の発火時刻を記録する。
    /// 初回(前回記録なし)は nil。
    @discardableResult
    public static func recordWidgetFireAndMeasureGap(now: Date = Date()) -> Int? {
        guard let d = defaults else { return nil }
        let previous = d.object(forKey: MimamoriConstants.lastWidgetFireAtKey) as? Double
        d.set(now.timeIntervalSince1970, forKey: MimamoriConstants.lastWidgetFireAtKey)
        guard let previous else { return nil }
        let gap = now.timeIntervalSince1970 - previous
        guard gap >= 0 else { return nil }
        return Int(gap)
    }

    // MARK: - 充電遷移の検出

    /// 前回観測した充電状態と比較し、未接続 → 接続の遷移なら charging_start シグナルを返す。
    /// 遷移がなければ nil。呼び出しのたびに現在の状態を保存する。
    ///
    /// 注意: iOS には充電開始でアプリを起こす公開 API がないため、これは
    /// 「起きたタイミングのスナップショット同士の差分」による推定でしかない。
    /// 起床の合間に挿抜が完結した場合は観測できない。
    public static func detectChargingTransition(current: Snapshot, at date: Date = Date()) -> Signal? {
        guard let d = defaults else { return nil }
        let previous = d.string(forKey: MimamoriConstants.lastBatteryStateKey)
        d.set(current.batteryState, forKey: MimamoriConstants.lastBatteryStateKey)

        guard let previous, previous != current.batteryState else { return nil }
        let wasPluggedIn = previous == "charging" || previous == "full"
        let isPluggedIn = current.batteryState == "charging" || current.batteryState == "full"
        guard !wasPluggedIn, isPluggedIn else { return nil }

        var meta = metaFields(from: current)
        meta["from"] = previous
        return Signal(type: SignalType.chargingStart, observedAt: date, meta: meta)
    }

    // MARK: - 常駐計測モード

    /// 位置情報を出しっぱなしにしてロック解除イベントを捕まえる検証モードの ON/OFF。
    public static var isResidencyEnabled: Bool {
        get { defaults?.bool(forKey: MimamoriConstants.residencyEnabledKey) ?? false }
        set { defaults?.set(newValue, forKey: MimamoriConstants.residencyEnabledKey) }
    }
}
