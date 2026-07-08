import Foundation

/// Firebase 由来の IDトークン取得を抽象化。
/// アプリ本体側で Firebase Auth SDK と繋ぎ、App Group Keychain 経由で拡張と共有する想定。
public protocol AuthTokenProvider {
    func currentIdToken() async throws -> String
}

/// 拡張が使う簡易実装: App Group Keychain から最後にキャッシュされた IDトークンを読む。
/// アプリ本体が定期的にトークンを更新して書き込む前提。
public final class SharedKeychainTokenProvider: AuthTokenProvider {
    public init() {}
    public func currentIdToken() async throws -> String {
        try SharedTokenStore.read()
    }
}

public enum SharedTokenStore {
    private static let service = "com.crouton.mimamori.token"
    private static let account = "firebase-id-token"

    public static func write(_ token: String) throws {
        let data = Data(token.utf8)
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
            throw NSError(domain: "SharedTokenStore", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Keychain 書き込み失敗"])
        }
    }

    public static func read() throws -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: MimamoriConstants.appGroup,
            kSecReturnData as String: true,
        ]
        var out: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        guard status == errSecSuccess, let data = out as? Data, let token = String(data: data, encoding: .utf8) else {
            throw NSError(domain: "SharedTokenStore", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Keychain 読み取り失敗"])
        }
        return token
    }
}
