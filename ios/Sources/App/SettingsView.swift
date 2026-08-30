import MimamoriKit
import SwiftUI
import UserNotifications

/// 設定画面。
/// 権限まわりの状態確認と、iOS の自動オフロード対策のユーザー説明を担う。
struct SettingsView: View {
    @EnvironmentObject private var auth: AuthManager

    @State private var screenTimeAuthorized = ScreenTimeManager.shared.isAuthorized
    @State private var screenTimeError: String?
    @State private var notificationsAuthorized: Bool?
    @State private var invitation: APIClient.Invitation?
    @State private var invitationError: String?

    var body: some View {
        Form {
            Section("アカウント") {
                LabeledContent("メールアドレス", value: auth.email ?? "-")
                Button("ログアウト", role: .destructive) {
                    auth.signOut()
                }
            }

            Section {
                LabeledContent("使用状況の取得") {
                    Text(screenTimeAuthorized ? "有効" : "未設定")
                        .foregroundStyle(screenTimeAuthorized ? Color.brand : Color.secondary)
                }
                if !screenTimeAuthorized {
                    Button("スクリーンタイムの利用を許可する") {
                        Task { await enableScreenTime() }
                    }
                }
                if let screenTimeError {
                    Text(screenTimeError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
                LabeledContent("位置情報") {
                    Text(locationStatusLabel)
                        .foregroundStyle(locationAlways ? Color.brand : Color.secondary)
                }
                if !locationAlways {
                    Button("位置情報を「常に許可」にする") {
                        LocationPushManager.shared.requestPermission()
                    }
                }
                LabeledContent("通知") {
                    Text(notificationsAuthorized == true ? "有効" : "未設定")
                        .foregroundStyle(notificationsAuthorized == true ? Color.brand : Color.secondary)
                }
                if notificationsAuthorized == false {
                    Button("設定アプリで通知を許可する") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                }
            } header: {
                Text("見守りシグナル")
            } footer: {
                Text("スマホを普段どおり使うだけで「元気にしている」ことが家族に伝わります。位置情報やアプリの中身は送信されません。")
            }

            Section {
                Text("iPhone には、しばらく開かれていないアプリを自動的に取り除く機能があります。このアプリが取り除かれると見守りが止まってしまうため、以下の設定をおすすめします。")
                    .font(.footnote)
                VStack(alignment: .leading, spacing: 4) {
                    Text("設定 > App Store")
                        .font(.footnote.bold())
                    Text("「非使用のAppを取り除く」をオフにする")
                        .font(.footnote.bold())
                }
                Text("この設定をしない場合でも、しばらくアプリが開かれていないときは通知でお知らせします。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } header: {
                Text("見守りを止めないために")
            }

            Section {
                if let invitation {
                    LabeledContent("招待コード") {
                        Text(invitation.code)
                            .font(.title3.monospaced().bold())
                    }
                    Text("有効期限: \(invitation.expiresAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Button(invitation == nil ? "招待コードを発行" : "コードを再発行") {
                    Task { await createInvitation() }
                }
                if let invitationError {
                    Text(invitationError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            } header: {
                Text("家族との連携")
            } footer: {
                Text("見守る側の家族に、Web ダッシュボードでこのコードを入力してもらうと連携が完了します。")
            }

            Section {
                Text("ショートカット App の「オートメーション」で、毎朝のアラーム停止時に mimamo-ri の「元気です」を実行するよう設定すると、目覚ましを止めるだけで家族に元気が伝わります。")
                    .font(.footnote)
                VStack(alignment: .leading, spacing: 4) {
                    Text("ショートカット > オートメーション > 新規")
                        .font(.footnote.bold())
                    Text("「アラームが停止したとき」>「すぐに実行」> アクションで「元気です」を選択")
                        .font(.footnote.bold())
                }
                Text("この設定は自動では行えないため、ご家族が手伝ってあげてください。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } header: {
                Text("さらに確実にする(おすすめ)")
            }

            Section("開発情報") {
                LabeledContent("接続先", value: MimamoriConstants.apiBaseURL.absoluteString)
            }
        }
        .navigationTitle("設定")
        .task {
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            notificationsAuthorized = settings.authorizationStatus == .authorized
        }
    }

    private var locationAlways: Bool {
        LocationPushManager.shared.authorizationStatus == .authorizedAlways
    }

    private var locationStatusLabel: String {
        switch LocationPushManager.shared.authorizationStatus {
        case .authorizedAlways: return "常に許可"
        case .authorizedWhenInUse: return "使用中のみ"
        case .denied, .restricted: return "拒否"
        default: return "未設定"
        }
    }

    private func createInvitation() async {
        do {
            invitation = try await APIClient().createInvitation()
            invitationError = nil
        } catch {
            invitationError = "発行に失敗しました: \(error.localizedDescription)"
        }
    }

    private func enableScreenTime() async {
        do {
            try await ScreenTimeManager.shared.requestAuthorization()
            try ScreenTimeManager.shared.startMonitoring()
            screenTimeAuthorized = ScreenTimeManager.shared.isAuthorized
            screenTimeError = nil
        } catch {
            screenTimeError = "許可に失敗しました: \(error.localizedDescription)"
        }
    }
}
