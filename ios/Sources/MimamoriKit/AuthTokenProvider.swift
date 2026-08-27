import Foundation

/// Firebase 由来の IDトークン取得を抽象化。
public protocol AuthTokenProvider: Sendable {
    func currentIdToken() async throws -> String
}

/// App Group Keychain に保存する認証状態。
/// アプリ本体がログイン時・フォアグラウンド時に書き込み、
/// 拡張(NSE / Widget / LocationPush)はこれを読んで API を叩く。
public struct SharedAuthState: Codable, Sendable {
    public var idToken: String
    public var refreshToken: String
    /// Firebase Web API Key(GoogleService-Info.plist の API_KEY)。
    /// 拡張が Firebase SDK なしでトークンをリフレッシュするために保持する。
    public var apiKey: String
    public var expiresAt: Date
    /// ローカル開発時の Auth エミュレータのホスト(例 "127.0.0.1:9099")。
    /// 設定されている場合、トークンリフレッシュ先をエミュレータに向ける。
    public var authEmulatorHost: String?

    public init(idToken: String, refreshToken: String, apiKey: String, expiresAt: Date, authEmulatorHost: String? = nil) {
        self.idToken = idToken
        self.refreshToken = refreshToken
        self.apiKey = apiKey
        self.expiresAt = expiresAt
        self.authEmulatorHost = authEmulatorHost
    }
}

public enum SharedTokenStoreError: Error {
    case notFound
    case keychain(OSStatus)
}

/// App Group Keychain への認証状態の読み書き。
public enum SharedTokenStore {
    private static let service = "com.crouton.mimamori.token"
    private static let account = "firebase-auth-state.v1"

    public static func write(_ state: SharedAuthState) throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(state)
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: MimamoriConstants.appGroup,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemDelete(query as CFDictionary)
        query[kSecValueData as String] = data
        let status = SecItemAdd(query as CFDictionary, nil)
        if status != errSecSuccess {
            throw SharedTokenStoreError.keychain(status)
        }
    }

    public static func read() throws -> SharedAuthState {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: MimamoriConstants.appGroup,
            kSecReturnData as String: true,
        ]
        var out: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        guard status == errSecSuccess, let data = out as? Data else {
            throw SharedTokenStoreError.notFound
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(SharedAuthState.self, from: data)
    }

    public static func clear() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: MimamoriConstants.appGroup,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

/// 共有 Keychain の認証状態から IDトークンを供給する実装。
/// 期限が近い場合は Firebase Secure Token API(REST)でリフレッシュして書き戻す。
/// 拡張プロセスに Firebase SDK を載せずに済ませるための構成で、
/// これにより「アプリ本体が長期間開かれなくても」拡張が自力で認証を維持できる。
public actor SharedKeychainTokenProvider: AuthTokenProvider {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func currentIdToken() async throws -> String {
        var state = try SharedTokenStore.read()
        // 期限まで5分以上あればそのまま使う
        if state.expiresAt.timeIntervalSinceNow > 300 {
            return state.idToken
        }

        let endpoint = state.authEmulatorHost.map {
            "http://\($0)/securetoken.googleapis.com/v1/token"
        } ?? "https://securetoken.googleapis.com/v1/token"
        var comps = URLComponents(string: endpoint)!
        comps.queryItems = [URLQueryItem(name: "key", value: state.apiKey)]
        var req = URLRequest(url: comps.url!)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        var bodyComps = URLComponents()
        bodyComps.queryItems = [
            URLQueryItem(name: "grant_type", value: "refresh_token"),
            URLQueryItem(name: "refresh_token", value: state.refreshToken),
        ]
        req.httpBody = Data((bodyComps.percentEncodedQuery ?? "").utf8)

        let (data, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
            throw NSError(
                domain: "SharedKeychainTokenProvider",
                code: (resp as? HTTPURLResponse)?.statusCode ?? -1,
                userInfo: [NSLocalizedDescriptionKey: "IDトークンのリフレッシュに失敗"],
            )
        }

        struct RefreshResponse: Decodable {
            let idToken: String
            let refreshToken: String
            let expiresIn: String
            enum CodingKeys: String, CodingKey {
                case idToken = "id_token"
                case refreshToken = "refresh_token"
                case expiresIn = "expires_in"
            }
        }
        let refreshed = try JSONDecoder().decode(RefreshResponse.self, from: data)
        state.idToken = refreshed.idToken
        state.refreshToken = refreshed.refreshToken
        state.expiresAt = Date().addingTimeInterval(TimeInterval(refreshed.expiresIn) ?? 3600)
        try? SharedTokenStore.write(state)
        return state.idToken
    }
}
