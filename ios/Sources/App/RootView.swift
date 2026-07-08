import SwiftUI

struct RootView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("mimamo-ri")
                    .font(.largeTitle).bold()
                Text("見守り中")
                    .foregroundStyle(.secondary)
                NavigationLink("設定") { SettingsView() }
                Button("元気です") { Task { try? await APIClientHolder.shared.client.checkin() } }
                    .buttonStyle(.borderedProminent)
            }
            .padding()
        }
    }
}

struct SettingsView: View {
    var body: some View {
        Form {
            Section("アカウント") {
                Text("Firebase Auth 実装は SDK 導入後に組み込む予定")
            }
            Section("権限") {
                Text("使用状況(スクリーンタイム) / 位置情報「常に許可」/ モーション / 通知")
            }
        }
    }
}

/// アプリ内で APIClient を1つ保持するホルダー(拡張は自前で作る)。
import MimamoriKit
final class APIClientHolder {
    static let shared = APIClientHolder()
    let client: APIClient
    private init() { self.client = APIClient() }
}
