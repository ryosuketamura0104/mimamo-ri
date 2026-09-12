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
final class LocationPushManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    static let shared = LocationPushManager()

    private let manager = CLLocationManager()

    /// 位置サービスの利用意思を宣言するセッション。
    /// Apple は LPSE について「アプリと拡張の両方で、動作中は常に保持せよ」と
    /// 明記している。これが無いと location プッシュを送っても拡張が起動されない。
    /// CLServiceSession は iOS 18+ なので、iOS 17 も対象に残すため Any? で保持する。
    private var serviceSession: Any?

    /// 認可状態。View が変化を検知できるよう published にする
    /// (計算プロパティのままだと、許可した直後に表示が古いままになる)。
    @Published private(set) var authorizationStatus: CLAuthorizationStatus = .notDetermined

    /// ロケーションプッシュの状態(設定画面の診断表示用)。
    /// エンタイトルメントが無いと startMonitoringLocationPushes がエラーを返すため、
    /// 成否をここに出さないと実機で何が起きているか分からない。
    @Published private(set) var locationPushStatus = "未開始" 

    private override init() {
        super.init()
        manager.delegate = self
        authorizationStatus = manager.authorizationStatus
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
        guard manager.authorizationStatus == .authorizedAlways else {
            locationPushStatus = "位置情報「常に許可」が必要"
            return
        }
        // セッションは起動中ずっと保持し続ける必要がある
        if #available(iOS 18.0, *), serviceSession == nil {
            serviceSession = CLServiceSession(authorization: .always)
        }
        locationPushStatus = "トークン要求中..."
        manager.startMonitoringLocationPushes { [weak self] token, error in
            Task { @MainActor in
                if let error {
                    // エンタイトルメント未取得ならここに来る
                    self?.locationPushStatus = "エラー: \(error.localizedDescription)"
                    return
                }
                guard let token else {
                    self?.locationPushStatus = "トークンが nil"
                    return
                }
                let hex = token.map { String(format: "%02x", $0) }.joined()
                let defaults = UserDefaults(suiteName: MimamoriConstants.appGroup)
                defaults?.set(hex, forKey: MimamoriConstants.locationPushTokenKey)

                // サーバーは pushToken 必須のため、保留中の APNs トークンと併せて送る
                guard let pushToken = defaults?.string(forKey: MimamoriConstants.pendingPushTokenKey) else {
                    self?.locationPushStatus = "トークン取得OK / APNsトークン未取得のため未登録"
                    return
                }
                do {
                    try await APIClient().registerDevice(pushToken: pushToken, locationPushToken: hex)
                    self?.locationPushStatus = "登録済み"
                } catch {
                    self?.locationPushStatus = "トークン取得OK / 登録失敗: \(error.localizedDescription)"
                }
            }
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            self.authorizationStatus = manager.authorizationStatus
            if manager.authorizationStatus == .authorizedWhenInUse {
                // 使用中許可が取れたら続けて「常に許可」を求める
                manager.requestAlwaysAuthorization()
            }
            self.startIfPossible()
        }
    }
}
