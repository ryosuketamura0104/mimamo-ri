import Foundation

/// サーバー API クライアント。
/// アプリ本体と拡張(NSE/LocationPush 等)から共通で使う。
public final class APIClient {
    public let baseURL: URL
    public let tokenProvider: AuthTokenProvider
    private let session: URLSession

    public init(baseURL: URL = MimamoriConstants.apiBaseURL, tokenProvider: AuthTokenProvider = SharedKeychainTokenProvider(), session: URLSession = .shared) {
        self.baseURL = baseURL
        self.tokenProvider = tokenProvider
        self.session = session
    }

    private struct SignalsBody: Encodable { let signals: [Signal] }
    private struct SignalsResponse: Decodable { let inserted: Int; let resolvedEscalationId: String? }

    private struct RegisterDeviceBody: Encodable {
        let platform: String
        let pushToken: String?
        let locationPushToken: String?
        let appVersion: String?
        let osVersion: String?
    }

    @discardableResult
    public func postSignals(_ signals: [Signal]) async throws -> Int {
        let response: SignalsResponse = try await postJSON("/api/v1/signals", body: SignalsBody(signals: signals))
        return response.inserted
    }

    public func registerDevice(pushToken: String? = nil, locationPushToken: String? = nil, appVersion: String? = nil, osVersion: String? = nil) async throws {
        let body = RegisterDeviceBody(platform: "ios", pushToken: pushToken, locationPushToken: locationPushToken, appVersion: appVersion, osVersion: osVersion)
        let _: [String: AnyCodable] = try await postJSON("/api/v1/devices", body: body)
    }

    public func checkin() async throws {
        struct Empty: Encodable {}
        struct Resp: Decodable { let resolvedEscalationId: String? }
        let _: Resp = try await postJSON("/api/v1/checkin", body: Empty())
    }

    private func postJSON<Body: Encodable, Response: Decodable>(_ path: String, body: Body) async throws -> Response {
        let url = baseURL.appendingPathComponent(path)
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let token = try await tokenProvider.currentIdToken()
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        req.httpBody = try encoder.encode(body)
        let (data, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw NSError(domain: "APIClient", code: (resp as? HTTPURLResponse)?.statusCode ?? -1)
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(Response.self, from: data)
    }
}

/// 任意の JSON レスポンスを受けるための緩いデコード。
public struct AnyCodable: Codable {}
