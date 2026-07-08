import CoreLocation
import MimamoriKit

/// CLLocationPushServiceExtension: サーバーからロケーションプッシュが届くと起動され、
/// 位置取得 + ロック状態プローブ + シグナルキューフラッシュを行う。
///
/// Apple のエンタイトルメント申請が承認されるまでは配信できないが、
/// コードとしては先に用意しておく。
@objc(LocationPushService)
final class LocationPushService: NSObject, CLLocationPushServiceExtension, CLLocationManagerDelegate {

    private var completion: (() -> Void)?
    private lazy var manager: CLLocationManager = {
        let m = CLLocationManager()
        m.delegate = self
        m.desiredAccuracy = kCLLocationAccuracyHundredMeters
        return m
    }()

    func didReceiveLocationPushPayload(_ payload: [String: Any], completion: @escaping () -> Void) {
        self.completion = completion
        Task {
            let unlocked = LockStateProbe.isDeviceUnlocked()
            var meta: [String: String] = [:]
            if let u = unlocked { meta["unlocked"] = u ? "true" : "false" }
            await SignalQueue.shared.append(Signal(type: SignalType.locationPing, meta: meta))
        }
        // 位置取得を1回行う
        manager.requestLocation()
        // 万一 delegate が呼ばれない場合の保険(15秒)
        DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in
            self?.finish()
        }
    }

    func serviceExtensionWillTerminate() {
        finish()
    }

    private func finish() {
        guard let done = completion else { return }
        completion = nil
        Task {
            await SignalFlusher.flush()
            done()
        }
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let loc = locations.last {
            Task {
                await SignalQueue.shared.append(Signal(
                    type: SignalType.locationPing,
                    meta: ["lat": "\(loc.coordinate.latitude)", "lng": "\(loc.coordinate.longitude)"],
                ))
                finish()
            }
        } else {
            finish()
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        finish()
    }
}
