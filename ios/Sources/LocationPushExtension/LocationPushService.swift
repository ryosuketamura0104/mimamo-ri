import CoreLocation
import MimamoriKit

/// CLLocationPushServiceExtension: サーバーからロケーションプッシュが届くと起動され、
/// 位置取得 + ロック状態プローブ + シグナルキューフラッシュを行う。
///
/// アプリ本体が強制終了されていても、拡張は別プロセスとして起動される。
/// そのため「kill されても定期的に端末を起こしてログを回収する」経路になる。
@objc(LocationPushService)
final class LocationPushService: NSObject, CLLocationPushServiceExtension, CLLocationManagerDelegate {

    private var completion: (() -> Void)?
    private var finished = false
    /// 拡張が動いている間も保持する必要がある(Apple の LPSE ガイド)。
    /// CLServiceSession は iOS 18+ なので、iOS 17 も対象に残すため Any? で保持する。
    private var serviceSession: Any?
    private var manager: CLLocationManager?

    func didReceiveLocationPushPayload(_ payload: [String: Any], completion: @escaping () -> Void) {
        self.completion = completion

        // 起動できた事実をまず記録する。位置取得が失敗しても
        // 「端末が生きていてプッシュで起こせた」ことは残したい
        Task {
            var meta: [String: String] = ["phase": "woken"]
            if let u = LockStateProbe.isDeviceUnlocked() {
                meta["unlocked"] = u ? "true" : "false"
            }
            await SignalQueue.shared.append(Signal(type: SignalType.locationPing, meta: meta))
        }

        // CLLocationManager + requestLocation のデリゲート方式は、LPSE 内では
        // コールバックが返ってこなかった(woken は記録されるが located/failed が来ない)。
        // Apple の LPSE サンプルと同じ CLLocationUpdate.liveUpdates() に切り替える。
        Task { [weak self] in
            if #available(iOS 18.0, *) {
                await MainActor.run { self?.serviceSession = CLServiceSession(authorization: .always) }
            }
            do {
                for try await update in CLLocationUpdate.liveUpdates(.default) {
                    if let loc = update.location {
                        await SignalQueue.shared.append(Signal(
                            type: SignalType.locationPing,
                            meta: [
                                "phase": "located",
                                "lat": String(loc.coordinate.latitude),
                                "lng": String(loc.coordinate.longitude),
                                "accuracy": String(Int(loc.horizontalAccuracy)),
                            ],
                        ))
                        self?.finish(reason: "located")
                        return
                    }
                    // 位置が取れない理由が分かる場合は残す(判定は iOS 18+ のみ)
                    if #available(iOS 18.0, *) {
                        if update.authorizationDenied || update.insufficientlyInUse {
                            await SignalQueue.shared.append(Signal(
                                type: SignalType.locationPing,
                                meta: [
                                    "phase": "blocked",
                                    "denied": String(update.authorizationDenied),
                                    "insufficientlyInUse": String(update.insufficientlyInUse),
                                ],
                            ))
                            self?.finish(reason: "blocked")
                            return
                        }
                    }
                }
            } catch {
                await SignalQueue.shared.append(Signal(
                    type: SignalType.locationPing,
                    meta: ["phase": "failed", "error": error.localizedDescription],
                ))
                self?.finish(reason: "failed")
            }
        }

        // 拡張の実行時間は約30秒。測位が返らない場合に備えて手前で打ち切る
        DispatchQueue.main.asyncAfter(deadline: .now() + 25) { [weak self] in
            self?.finish(reason: "timeout")
        }
    }

    func serviceExtensionWillTerminate() {
        finish(reason: "terminating")
    }

    /// 送信して完了を通知する。複数経路から呼ばれるため一度だけ実行する。
    private func finish(reason: String) {
        guard !finished, let done = completion else { return }
        finished = true
        completion = nil
        Task {
            await SignalFlusher.flush()
            done()
        }
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else {
            finish(reason: "empty")
            return
        }
        Task {
            await SignalQueue.shared.append(Signal(
                type: SignalType.locationPing,
                meta: [
                    "phase": "located",
                    "lat": String(loc.coordinate.latitude),
                    "lng": String(loc.coordinate.longitude),
                    "accuracy": String(Int(loc.horizontalAccuracy)),
                ],
            ))
            finish(reason: "located")
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // 失敗理由を残す。ここが分からないと位置が取れない原因を追えない
        Task {
            await SignalQueue.shared.append(Signal(
                type: SignalType.locationPing,
                meta: ["phase": "failed", "error": error.localizedDescription],
            ))
            finish(reason: "failed")
        }
    }
}
