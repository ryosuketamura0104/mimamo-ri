import MimamoriKit
import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthManager

    var body: some View {
        Group {
            if !auth.isConfigured {
                SetupRequiredView()
            } else if auth.isSignedIn {
                HomeView()
            } else {
                LoginView()
            }
        }
        .tint(.brand)
    }
}

/// GoogleService-Info.plist 未同梱の開発環境向け案内。
struct SetupRequiredView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.orange)
            Text("Firebase が未設定です")
                .font(.headline)
            Text("Firebase コンソールから GoogleService-Info.plist をダウンロードし、ios/Resources/ に配置してからビルドし直してください。")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

/// 見守られる側のホーム画面。
/// 高齢のユーザーが開いた時に迷わないよう、要素は最小限にする。
struct HomeView: View {
    @State private var lastCheckinAt: Date? = WidgetContentStore.lastCheckinAt
    @State private var message = WidgetContentStore.read()
    @State private var checkinDone = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // 見守り状態
                    HStack(spacing: 8) {
                        Circle()
                            .fill(Color.brand)
                            .frame(width: 10, height: 10)
                        Text("見守り中")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                    .padding(.top, 4)

                    // 家族からの最新メッセージ
                    VStack(spacing: 10) {
                        Text(message.title)
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(Color.onBrandContainer.opacity(0.75))
                        Text(message.body)
                            .font(.title2.weight(.semibold))
                            .foregroundStyle(Color.onBrandContainer)
                            .multilineTextAlignment(.center)
                        if let at = message.updatedAt {
                            Text(at.formatted(.dateTime.month().day().hour().minute()))
                                .font(.caption2)
                                .foregroundStyle(Color.onBrandContainer.opacity(0.6))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(24)
                    .background(Color.brandContainer, in: RoundedRectangle(cornerRadius: 24))

                    // 生存応答(最重要操作)
                    Button {
                        Task { await reportAlive() }
                    } label: {
                        Label(checkinDone ? "伝えました" : "元気です", systemImage: checkinDone ? "checkmark.circle.fill" : "hand.thumbsup.fill")
                            .font(.title2.bold())
                            .frame(maxWidth: .infinity, minHeight: 64)
                    }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.roundedRectangle(radius: 20))
                    .disabled(checkinDone)

                    if let at = lastCheckinAt {
                        Text("最後の「元気です」: \(at.formatted(date: .abbreviated, time: .shortened))")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    Spacer(minLength: 0)
                }
                .padding(20)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("mimamo-ri")
            .toolbar {
                NavigationLink {
                    SettingsView()
                } label: {
                    Image(systemName: "gearshape")
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
                message = WidgetContentStore.read()
                lastCheckinAt = WidgetContentStore.lastCheckinAt
                checkinDone = false
            }
            // Siri / Spotlight に「元気です」操作を学習させる donation
            .userActivity(MimamoriConstants.reportAliveActivityType) { activity in
                activity.title = "元気です"
                activity.isEligibleForPrediction = true
                activity.isEligibleForSearch = true
            }
            // Spotlight 等から NSUserActivity 経由で開かれた場合はそのまま生存応答
            .onContinueUserActivity(MimamoriConstants.reportAliveActivityType) { _ in
                Task { await reportAlive() }
            }
        }
    }

    private func reportAlive() async {
        await SignalQueue.shared.append(Signal(type: SignalType.checkinTap, meta: ["src": "app"]))
        let sent = await SignalFlusher.flush()
        if sent {
            WidgetContentStore.recordCheckin()
            lastCheckinAt = WidgetContentStore.lastCheckinAt
            checkinDone = true
        }
    }
}
