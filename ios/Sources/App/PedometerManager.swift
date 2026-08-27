import CoreMotion
import Foundation
import MimamoriKit

/// 歩数シグナルの収集。
/// アプリ(または BGタスク)が動いた瞬間に「今日の歩数」を CMPedometer から取り、
/// steps シグナルとして積む。サーバー側は meta.steps > 0 のときのみ
/// 人シグナル(生存の証明)として扱う。
final class PedometerManager: @unchecked Sendable {
    static let shared = PedometerManager()
    private let pedometer = CMPedometer()

    private init() {}

    /// 今日の歩数を取得してシグナルキューに積む。
    /// - Parameter allowPrompt: false の場合、モーション権限が未確定なら何もしない
    ///   (BGタスクから権限ダイアログを出さないため)。
    func collectAndEnqueue(allowPrompt: Bool) async {
        guard CMPedometer.isStepCountingAvailable() else { return }
        switch CMPedometer.authorizationStatus() {
        case .denied, .restricted:
            return
        case .notDetermined:
            // 初回クエリが権限ダイアログを兼ねる
            if !allowPrompt { return }
        case .authorized:
            break
        @unknown default:
            return
        }

        let start = Calendar.current.startOfDay(for: Date())
        let steps: Int? = await withCheckedContinuation { continuation in
            pedometer.queryPedometerData(from: start, to: Date()) { data, _ in
                continuation.resume(returning: data.map { $0.numberOfSteps.intValue })
            }
        }
        guard let steps else { return }
        await SignalQueue.shared.append(Signal(
            type: SignalType.steps,
            meta: ["steps": String(steps)],
        ))
    }
}
