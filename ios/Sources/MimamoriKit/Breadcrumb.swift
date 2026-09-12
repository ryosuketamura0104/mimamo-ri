import Foundation

/// 実機での挙動を追うための足跡。
///
/// 実機は Xcode を繋がずに運用しており、この macOS の `log stream` は
/// 実機ログに対応していない。一方 App Group の UserDefaults は
/// `devicectl device copy from` で母艦から吸い出せるため、
/// 要所で足跡を残しておけば「どこまで進んだか」を後から確認できる。
public enum Breadcrumb {
    private static let key = "breadcrumbs.v1"
    private static let limit = 40

    public static func drop(_ message: String) {
        guard let d = UserDefaults(suiteName: MimamoriConstants.appGroup) else { return }
        let stamp = ISO8601DateFormatter().string(from: Date())
        var list = d.stringArray(forKey: key) ?? []
        list.append("\(stamp) \(message)")
        if list.count > limit { list = Array(list.suffix(limit)) }
        d.set(list, forKey: key)
    }

    public static func all() -> [String] {
        UserDefaults(suiteName: MimamoriConstants.appGroup)?.stringArray(forKey: key) ?? []
    }
}
