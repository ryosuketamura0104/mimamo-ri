import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import MimamoriKit

/// Screen Time API との橋渡し。
/// - 承認取得
/// - 全カテゴリを対象にした DeviceActivitySchedule + Event の登録
///
/// スパイク検証用に 15分/1分 の2つのイベントを同時に張り、
/// 発火頻度を比較できるようにしてある。
@MainActor
final class ScreenTimeManager {
    static let shared = ScreenTimeManager()

    private let center = DeviceActivityCenter()
    private let ac = AuthorizationCenter.shared

    /// FamilyControls 承認をユーザーに求める。
    func requestAuthorization() async throws {
        try await ac.requestAuthorization(for: .individual)
    }

    /// 承認済みか。
    var isAuthorized: Bool {
        switch ac.authorizationStatus {
        case .approved: return true
        default: return false
        }
    }

    /// 監視スケジュールを開始する。
    /// - Parameter intervalHours: 区間の刻み(ユーザー設定の activityIntervalHours)。
    func startMonitoring(intervalHours: Int = 6) throws {
        // 監視をクリアしてから再登録
        center.stopMonitoring()

        // 1日を intervalHours ごとに区切る(端数は最後の区間で吸収)
        let now = Date()
        let calendar = Calendar.current
        var startComps = calendar.dateComponents([.hour, .minute], from: now)
        startComps.minute = 0
        var endHour = (startComps.hour ?? 0) + intervalHours
        if endHour > 23 { endHour = 23 }
        var endComps = DateComponents(); endComps.hour = endHour; endComps.minute = 59

        let schedule = DeviceActivitySchedule(
            intervalStart: startComps,
            intervalEnd: endComps,
            repeats: true,
            warningTime: nil,
        )

        // 全カテゴリを監視対象に(タイプは各バージョンで API シグネチャが若干変わる可能性あり)
        let events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [
            .init("usage_15min"): DeviceActivityEvent(
                applications: [],
                categories: [],
                webDomains: [],
                threshold: DateComponents(minute: 15),
            ),
            .init("usage_1min"): DeviceActivityEvent(
                applications: [],
                categories: [],
                webDomains: [],
                threshold: DateComponents(minute: 1),
            ),
        ]

        try center.startMonitoring(
            .init("mimamori.default"),
            during: schedule,
            events: events,
        )
    }
}
