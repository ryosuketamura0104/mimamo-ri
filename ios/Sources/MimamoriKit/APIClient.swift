import Foundation

/// サーバー API クライアント。
/// アプリ本体と拡張(NSE/Widget/LocationPush 等)から共通で使う。
public final class APIClient: Sendable {
    public let baseURL: URL
    public let tokenProvider: AuthTokenProvider
    private let session: URLSession

    public init(baseURL: URL = MimamoriConstants.apiBaseURL, tokenProvider: AuthTokenProvider = SharedKeychainTokenProvider(), session: URLSession = .shared) {
        self.baseURL = baseURL
        self.tokenProvider = tokenProvider
        self.session = session
    }

    // MARK: - エンドポイント

    private struct SignalsBody: Encodable { let signals: [Signal] }
    private struct SignalsResponse: Decodable { let inserted: Int; let resolvedEscalationId: String? }

    @discardableResult
    public func postSignals(_ signals: [Signal]) async throws -> Int {
        let response: SignalsResponse = try await requestJSON("POST", "/api/v1/signals", body: SignalsBody(signals: signals))
        return response.inserted
    }

    private struct RegisterDeviceBody: Encodable {
        let platform: String
        let pushToken: String?
        let locationPushToken: String?
        let appVersion: String?
        let osVersion: String?
    }

    public func registerDevice(pushToken: String? = nil, locationPushToken: String? = nil, appVersion: String? = nil, osVersion: String? = nil) async throws {
        let body = RegisterDeviceBody(platform: "ios", pushToken: pushToken, locationPushToken: locationPushToken, appVersion: appVersion, osVersion: osVersion)
        try await requestIgnoringResponse("POST", "/api/v1/devices", body: body)
    }

    private struct RegisterUserBody: Encodable {
        let role: String
        let name: String
        let timezone: String
    }

    /// 初回ユーザー登録。登録済みなら既存ユーザーが返る(冪等)。
    public func registerUser(role: String, name: String, timezone: String = TimeZone.current.identifier) async throws {
        let body = RegisterUserBody(role: role, name: name, timezone: timezone)
        try await requestIgnoringResponse("POST", "/api/v1/users/register", body: body)
    }

    @discardableResult
    public func checkin() async throws -> String? {
        struct Empty: Encodable {}
        struct Resp: Decodable { let resolvedEscalationId: String? }
        let resp: Resp = try await requestJSON("POST", "/api/v1/checkin", body: Empty())
        return resp.resolvedEscalationId
    }

    public struct Invitation: Decodable, Sendable {
        public let code: String
        public let expiresAt: Date
    }

    /// ペアリング用の6桁招待コードを発行する(見守られる側のみ)。
    public func createInvitation() async throws -> Invitation {
        struct Empty: Encodable {}
        return try await requestJSON("POST", "/api/v1/invitations", body: Empty())
    }

    public struct WatchedMessage: Decodable, Sendable {
        public let id: String
        public let body: String
        public let createdAt: Date
        public let readAt: Date?
    }

    /// 見守る側からの最新メッセージを取得(見守られる側自身のみ)。
    public func fetchMessages(limit: Int = 1) async throws -> [WatchedMessage] {
        struct Resp: Decodable { let messages: [APIClient.WatchedMessage] }
        let resp: Resp = try await requestJSON("GET", "/api/v1/messages", query: [URLQueryItem(name: "limit", value: String(limit))])
        return resp.messages
    }

    /// メッセージを既読にする(見守られる側)。冪等。
    public func markMessageRead(id: String) async throws {
        struct Empty: Encodable {}
        try await requestIgnoringResponse("POST", "/api/v1/messages/\(id)/read", body: Empty())
    }

    public struct WeatherInfo: Decodable, Sendable {
        public let condition: String
        public let temperatureC: Double
        public let temperatureMaxC: Double?
        public let temperatureMinC: Double?

        /// Widget や通知に出す一行表記(例「晴れ 28度 (20-29)」)。
        public var line: String {
            var s = "\(condition) \(Int(temperatureC.rounded()))度"
            if let max = temperatureMaxC, let min = temperatureMinC {
                s += " (\(Int(min.rounded()))-\(Int(max.rounded())))"
            }
            return s
        }
    }

    /// 天気を取得する(Widget・通知用)。
    public func fetchWeather(lat: Double, lng: Double) async throws -> WeatherInfo {
        struct Resp: Decodable { let weather: WeatherInfo }
        let resp: Resp = try await requestJSON("GET", "/api/v1/weather", query: [
            URLQueryItem(name: "lat", value: String(lat)),
            URLQueryItem(name: "lng", value: String(lng)),
        ])
        return resp.weather
    }

    // MARK: - 共通処理

    private struct NoBody: Encodable {}

    private func requestJSON<Response: Decodable>(_ method: String, _ path: String, query: [URLQueryItem]? = nil) async throws -> Response {
        let data = try await requestData(method, path, body: NoBody?.none, query: query)
        return try Self.decoder.decode(Response.self, from: data)
    }

    private func requestJSON<Body: Encodable, Response: Decodable>(_ method: String, _ path: String, body: Body, query: [URLQueryItem]? = nil) async throws -> Response {
        let data = try await requestData(method, path, body: body, query: query)
        return try Self.decoder.decode(Response.self, from: data)
    }

    /// レスポンスボディを読み捨てるリクエスト(ステータスのみ確認)。
    private func requestIgnoringResponse<Body: Encodable>(_ method: String, _ path: String, body: Body) async throws {
        _ = try await requestData(method, path, body: body, query: nil)
    }

    private func requestData<Body: Encodable>(_ method: String, _ path: String, body: Body?, query: [URLQueryItem]?) async throws -> Data {
        var url = baseURL.appendingPathComponent(path)
        if let query, var comps = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            comps.queryItems = query
            url = comps.url ?? url
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        let token = try await tokenProvider.currentIdToken()
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try Self.encoder.encode(body)
        }
        let (data, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw NSError(domain: "APIClient", code: (resp as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return data
    }

    // サーバー(JS)は "2026-08-27T01:23:45.678Z" のようにミリ秒付き ISO 8601 を返すため、
    // Foundation 標準の .iso8601 戦略では解釈できない。両対応のフォーマッタを使う。
    private static let isoWithFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let s = try container.decode(String.self)
            if let date = isoWithFraction.date(from: s) ?? isoPlain.date(from: s) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "日付を解釈できません: \(s)")
        }
        return d
    }()

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(isoWithFraction.string(from: date))
        }
        return e
    }()
}
