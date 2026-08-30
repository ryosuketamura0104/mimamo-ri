import CoreLocation
import Foundation
import MimamoriKit

/// ロケーションプッシュ(CLLocationPushServiceExtension)のトークン管理。
///
/// com.apple.developer.location.push エンタイトルメントは Apple 申請待ちのため
/// 現状 startMonitoringLocationPushes はエラーを返すが、承認されて project.yml の
/// コメントアウトを外せばコード変更なしでトークン登録まで繋がるようにしておく。
/// 位置情報「常に許可」が前提。
@MainActor
final class LocationPushManager: NSObject, CLLocationManagerDelegate {
    static let shared = LocationPushManager()

    private let manager = CLLocationManager()

    private override init() {
        super.init()
        manager.delegate = self
    }

    var authorizationStatus: CLAuthorizationStatus {
        manager.authorizationStatus
    }

    /// 位置情報の許可を段階的に求める(未確定なら使用中 → その後「常に許可」)。
    func requestPermission() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse:
            manager.requestAlwaysAuthorization()
        default:
            break
        }
    }

    /// 位置が使えるなら1回だけ現在地を取得し、天気取得用に App Group へ保存する。
    func refreshLocationForWeather() {
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            manager.requestLocation()
        default:
            break
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        WidgetContentStore.saveCoordinates(lat: loc.coordinate.latitude, lng: loc.coordinate.longitude)
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // 位置が取れなくても天気は既定座標(東京)で動くため無視
    }

    /// 「常に許可」が得られていればロケーションプッシュの監視を開始し、
    /// 得られたトークンをサーバーに登録する。
    /// エンタイトルメント未取得の間はエラーになるだけで無害。
    func startIfPossible() {
        guard manager.authorizationStatus == .authorizedAlways else { return }
        manager.startMonitoringLocationPushes { token, _ in
            guard let token else { return }
            let hex = token.map { String(format: "%02x", $0) }.joined()
            Task {
                // サーバーは pushToken 必須のため、保留中の APNs トークンと併せて送る
                guard let pushToken = UserDefaults(suiteName: MimamoriConstants.appGroup)?
                    .string(forKey: MimamoriConstants.pendingPushTokenKey) else { return }
                try? await APIClient().registerDevice(pushToken: pushToken, locationPushToken: hex)
            }
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            if manager.authorizationStatus == .authorizedWhenInUse {
                // 使用中許可が取れたら続けて「常に許可」を求める
                manager.requestAlwaysAuthorization()
            }
            self.startIfPossible()
        }
    }
}
