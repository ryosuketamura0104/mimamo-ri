import DeviceActivity
import Foundation
import MimamoriKit

/// DeviceActivityMonitor: 全カテゴリ「累積X分使用」イベント発火時に、
/// App Group の SignalQueue に screen_time シグナルを記録する。
/// 拡張はネットワーク不可なため、送信はアプリ本体/ロケーションプッシュ拡張が実行する。
///
/// スパイク検証で確認すべき挙動:
/// - しきい値15分 / 1分 での実発火頻度
/// - 6時間毎スケジュールで区間ごとに1回発火するか
/// - 低電力モード・再起動・強制終了後の継続性
final class MimamoriDeviceActivityMonitor: DeviceActivityMonitor {
    override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        super.eventDidReachThreshold(event, activity: activity)
        Task {
            let meta: [String: String] = [
                "activity": activity.rawValue,
                "event": event.rawValue,
            ]
            await SignalQueue.shared.append(Signal(type: SignalType.screenTime, meta: meta))
        }
    }

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        // 区間開始時にプローブを追加(spike 検証用)
        Task {
            await SignalQueue.shared.append(Signal(
                type: SignalType.screenTime,
                meta: ["activity": activity.rawValue, "event": "interval_start"],
            ))
        }
    }
}
