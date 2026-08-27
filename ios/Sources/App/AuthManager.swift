import FirebaseAuth
import FirebaseCore
import Foundation
import MimamoriKit
import UIKit

/// Firebase Auth との橋渡し。
/// ログイン状態を UI に公開しつつ、拡張が使う共有 Keychain
/// (SharedTokenStore)へ認証状態を書き出す責務を持つ。
@MainActor
final class AuthManager: ObservableObject {
    static let shared = AuthManager()

    /// GoogleService-Info.plist が同梱され FirebaseApp.configure 済みか。
    @Published private(set) var isConfigured = false
    @Published private(set) var isSignedIn = false

    private var listener: AuthStateDidChangeListenerHandle?

    private init() {}

    /// ローカル開発時の Auth エミュレータのホスト(Info.plist 経由、Debug のみ)。
    private var authEmulatorHost: String? {
        guard let s = Bundle.main.object(forInfoDictionaryKey: "FirebaseAuthEmulatorHost") as? String,
              !s.isEmpty else { return nil }
        return s
    }

    /// アプリ起動時に一度呼ぶ。GoogleService-Info.plist が無い開発環境でも
    /// クラッシュせず、UI 側でセットアップ手順を案内できるようにする。
    func configure() {
        guard FirebaseApp.app() == nil else {
            isConfigured = true
            return
        }
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
        } else if authEmulatorHost != nil {
            // ローカル開発: Auth エミュレータ用のダミー構成(plist 不要)。
            // googleAppID は "1:<数字>:ios:<16進>" の形式チェックがあるため末尾は16進にする
            let options = FirebaseOptions(googleAppID: "1:123456789012:ios:abcdef1234567890", gcmSenderID: "123456789012")
            options.apiKey = "demo-api-key"
            options.projectID = "demo-mimamori"
            FirebaseApp.configure(options: options)
        } else {
            isConfigured = false
            return
        }
        if let host = authEmulatorHost {
            let parts = host.split(separator: ":")
            let port = parts.count > 1 ? Int(parts[1]) ?? 9099 : 9099
            Auth.auth().useEmulator(withHost: String(parts[0]), port: port)
        }
        isConfigured = true
        isSignedIn = Auth.auth().currentUser != nil
        listener = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                self?.isSignedIn = user != nil
            }
        }
    }

    /// 新規登録(見守られる側)。Firebase 登録後にサーバーへユーザー作成、
    /// 認証状態の共有、保留中デバイストークンの登録まで行う。
    func signUp(name: String, email: String, password: String) async throws {
        try await Auth.auth().createUser(withEmail: email, password: password)
        try await syncSharedAuthState()
        try await APIClient().registerUser(role: "watched", name: name)
        await registerDeviceIfPossible()
    }

    func signIn(email: String, password: String) async throws {
        try await Auth.auth().signIn(withEmail: email, password: password)
        try await syncSharedAuthState()
        await registerDeviceIfPossible()
    }

    func signOut() {
        try? Auth.auth().signOut()
        SharedTokenStore.clear()
        isSignedIn = false
    }

    var email: String? {
        Auth.auth().currentUser?.email
    }

    /// Firebase の IDトークン・リフレッシュトークンを共有 Keychain に書き出す。
    /// 拡張はこの状態を起点に REST で自力リフレッシュするため、
    /// アプリ本体が開かれた時に呼んでおけば以後は放置でよい。
    func syncSharedAuthState() async throws {
        guard isConfigured, let user = Auth.auth().currentUser else { return }
        guard let apiKey = FirebaseApp.app()?.options.apiKey else { return }
        let result = try await user.getIDTokenResult(forcingRefresh: false)
        guard let refreshToken = user.refreshToken else { return }
        let state = SharedAuthState(
            idToken: result.token,
            refreshToken: refreshToken,
            apiKey: apiKey,
            expiresAt: result.expirationDate,
            authEmulatorHost: authEmulatorHost,
        )
        try SharedTokenStore.write(state)
    }

    /// APNs トークンが発行済みならサーバーに登録する。
    /// トークン発行はログインより先に起きるため、App Group に保留した値を使う。
    func registerDeviceIfPossible() async {
        guard isSignedIn else { return }
        let defaults = UserDefaults(suiteName: MimamoriConstants.appGroup)
        guard let token = defaults?.string(forKey: MimamoriConstants.pendingPushTokenKey) else { return }
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
        try? await APIClient().registerDevice(
            pushToken: token,
            appVersion: appVersion,
            osVersion: UIDevice.current.systemVersion,
        )
    }
}
