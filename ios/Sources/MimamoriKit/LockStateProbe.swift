import Foundation

/// 保護ファイルの読み取り試行で「今ロック解除中か」を推定する。
/// アプリ本体で `ensureProbeFile()` を解除中に実行してファイルを作成しておき、
/// 各拡張が `isDeviceUnlocked()` で読み取り試行する。
///
/// `UIApplication.isProtectedDataAvailable` は拡張で使えないためこの方式を用いる。
public enum LockStateProbe {

    private static var probeURL: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: MimamoriConstants.appGroup)?
            .appendingPathComponent(MimamoriConstants.protectedProbeFilename)
    }

    /// アプリ本体からロック解除中に一度呼ぶ。以後、拡張が読み取り試行できるようになる。
    public static func ensureProbeFile() {
        guard let url = probeURL else { return }
        if FileManager.default.fileExists(atPath: url.path) { return }
        do {
            let data = Data("probe".utf8)
            try data.write(to: url, options: .completeFileProtection)
        } catch {
            // 書き込み失敗は無視(拡張側で false 判定になるだけ)
        }
    }

    /// 現在ロック解除中かを推定する。
    /// - Returns: 読めれば true(解除中)、EPERM で失敗すれば false(ロック中)、判定不能は nil。
    public static func isDeviceUnlocked() -> Bool? {
        guard let url = probeURL else { return nil }
        do {
            _ = try Data(contentsOf: url, options: [])
            return true
        } catch let error as NSError {
            // FileProtectionComplete で保護されたファイルはロック中に EPERM(1) を返す
            if error.domain == NSPOSIXErrorDomain && error.code == 1 {
                return false
            }
            return nil
        }
    }
}
