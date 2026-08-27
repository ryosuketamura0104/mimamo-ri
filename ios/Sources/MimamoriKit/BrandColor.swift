import SwiftUI
import UIKit

/// ブランドカラー: 深いエメラルドグリーン。
/// アプリ本体と Widget で共通利用するため MimamoriKit に置く。
public extension Color {
    /// プライマリ(ライト #047857 / ダーク #34D399)
    static let brand = Color(UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0x34 / 255.0, green: 0xD3 / 255.0, blue: 0x99 / 255.0, alpha: 1)
            : UIColor(red: 0x04 / 255.0, green: 0x78 / 255.0, blue: 0x57 / 255.0, alpha: 1)
    })

    /// プライマリコンテナ(ライト #A7F3D0 / ダーク #005141)
    static let brandContainer = Color(UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0x00 / 255.0, green: 0x51 / 255.0, blue: 0x41 / 255.0, alpha: 1)
            : UIColor(red: 0xA7 / 255.0, green: 0xF3 / 255.0, blue: 0xD0 / 255.0, alpha: 1)
    })

    /// プライマリコンテナ上のテキスト(ライト #03301F / ダーク #A7F3D0)
    static let onBrandContainer = Color(UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0xA7 / 255.0, green: 0xF3 / 255.0, blue: 0xD0 / 255.0, alpha: 1)
            : UIColor(red: 0x03 / 255.0, green: 0x30 / 255.0, blue: 0x1F / 255.0, alpha: 1)
    })
}
