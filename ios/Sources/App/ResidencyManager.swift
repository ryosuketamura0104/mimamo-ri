import CoreLocation
import Foundation
import MimamoriKit
import UIKit

/// 常駐計測モード。
///
/// 検証したいこと: 位置情報を出しっぱなしにしてプロセスを常駐させれば、
/// ロック解除を「状態のサンプリング」ではなく「イベント」として捕まえられるか。
///
/// 仕組み:
///   - `UIApplication.protectedDataDidBecomeAvailableNotification` は保護ファイルが
///     読めるようになったとき、つまりロック解除のたびに投稿される。
///     ただしプロセス内通知なので、サスペンド中のアプリは起こしてくれない。
///   - そこで位置情報を低精度で出し続けてプロセスを生かし、通知を受け取れるようにする。
///
/// コスト: 「常に許可」が必須で、電池も消費する。実測して割に合うか判断するための
/// 検証モードであり、既定では OFF。
@MainActor
final class ResidencyManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    static let shared = ResidencyManager()

    private let manager = CLLocationManager()
    private var observing = false
    @Published private(set) var isRunning = false
    @Published private(set) var statusLabel = "オフ"

    private override init() {
        super.init()
        manager.delegate = self
        // 常駐が目的なので精度は最低で良い(電池消費を抑える)
        manager.desiredAccuracy = kCLLocationAccuracyThreeKilometers
        manager.distanceFilter = 3000
        manager.pausesLocationUpdatesAutomatically = false
    }

    /// 設定が ON かつ「常に許可」が取れていれば常駐を開始する。
    func startIfEnabled() {
        observeProtectedDataNotifications()
        guard DeviceTelemetry.isResidencyEnabled else {
            stop()
            refreshStatus()
            return
        }
        guard manager.authorizationStatus == .authorizedAlways else {
            isRunning = false
            refreshStatus()
            return
        }
        guard !isRunning else { return }
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        manager.startUpdatingLocation()
        isRunning = true
        refreshStatus()
    }

    func stop() {
        defer { refreshStatus() }
        guard isRunning else { return }
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        isRunning = false
    }

    /// 設定画面の表示用テキストを現在の状態から作り直す。
    private func refreshStatus() {
        if !DeviceTelemetry.isResidencyEnabled { statusLabel = "オフ"; return }
        if manager.authorizationStatus != .authorizedAlways {
            statusLabel = "位置情報「常に許可」が必要"; return
        }
        statusLabel = isRunning ? "計測中" : "待機中"
    }

    // MARK: - ロック解除イベント

    private func observeProtectedDataNotifications() {
        guard !observing else { return }
        observing = true
        let center = NotificationCenter.default
        center.addObserver(
            forName: UIApplication.protectedDataDidBecomeAvailableNotification,
            object: nil,
            queue: .main,
        ) { _ in
            Task { @MainActor in await Self.record(type: SignalType.unlockEvent, flush: true) }
        }
        center.addObserver(
            forName: UIApplication.protectedDataWillBecomeUnavailableNotification,
            object: nil,
            queue: .main,
        ) { _ in
            // ロック直前。通信は間に合わない可能性が高いので記録のみ行い、送信は次の機会に任せる
            Task { @MainActor in await Self.record(type: SignalType.lockEvent, flush: false) }
        }
    }

    @MainActor
    private static func record(type: String, flush: Bool) async {
        let snapshot = DeviceTelemetry.snapshot()
        var meta = DeviceTelemetry.metaFields(from: snapshot)
        meta["src"] = "residency"
        await SignalQueue.shared.append(Signal(type: type, meta: meta))
        if flush {
            await SignalFlusher.flush()
        }
    }

    // MARK: - CLLocationManagerDelegate

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in self.startIfEnabled() }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        // 常駐が目的なので位置そのものは使わないが、天気用の座標としては再利用する
        guard let loc = locations.last else { return }
        WidgetContentStore.saveCoordinates(lat: loc.coordinate.latitude, lng: loc.coordinate.longitude)
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // 常駐の維持が目的なのでエラーは無視する
    }
}
