import BackgroundTasks
import MimamoriKit
import SwiftUI
import UserNotifications

@main
struct MimamoriApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var auth = AuthManager.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .task {
                    await AppLifecycle.foregroundSync(source: "launch")
                }
                .onChange(of: scenePhase) { _, newPhase in
                    if newPhase == .active {
                        Task { await AppLifecycle.foregroundSync(source: "foreground") }
                    }
                }
                .onOpenURL { url in
                    // Widget の起動導線(mimamori://open?src=widget)から開かれた場合も
                    // 通常起動と同じ同期を行う。app_open は foregroundSync 内で記録される。
                    let src = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                        .queryItems?.first(where: { $0.name == "src" })?.value
                    Task { await AppLifecycle.foregroundSync(source: src ?? "url") }
                }
        }
    }
}

/// フォアグラウンド復帰時にまとめて行う同期処理。
enum AppLifecycle {
    private static var lastRunAt: Date?

    /// アプリが開かれた(見えた)タイミングの一括同期。
    /// launch 直後は .task と scenePhase 変化が連続で呼ぶため、10秒はデバウンスする。
    @MainActor
    static func foregroundSync(source: String) async {
        if let last = lastRunAt, Date().timeIntervalSince(last) < 10 { return }
        lastRunAt = Date()

        // ロック解除中に保護ファイルを作成(拡張のロック状態プローブ用)
        LockStateProbe.ensureProbeFile()

        // 「開かれた」実績を作れたので、オフロード対策通知を今日起点で張り直す
        OffloadGuard.reschedule()

        // 拡張が使う認証状態を最新化
        try? await AuthManager.shared.syncSharedAuthState()

        // app_open は人シグナル。どこから開かれたかを meta に残す
        await SignalQueue.shared.append(Signal(type: SignalType.appOpen, meta: ["src": source]))

        // 歩数も一緒に取る(フォアグラウンドなので権限ダイアログ許可)
        await PedometerManager.shared.collectAndEnqueue(allowPrompt: true)

        await SignalFlusher.flush()

        // 天気取得用に現在地を更新(権限がある場合のみ)
        LocationPushManager.shared.refreshLocationForWeather()

        // Widget 表示を最新メッセージ+天気で更新。
        // フォアグラウンドでは画面にメッセージが出るためローカル通知は出さない
        await WidgetContentStore.refreshFromServer()

        // 最新の天気で毎朝の天気通知を予約し直す
        NotificationPlanner.scheduleMorningWeather()

        // デバイストークンが未登録なら登録
        await AuthManager.shared.registerDeviceIfPossible()

        // ロケーションプッシュの監視開始(権限とエンタイトルメントが揃っている場合のみ)
        LocationPushManager.shared.startIfPossible()

        // 常駐計測モード(設定が ON のときだけ)。ロック解除をイベントとして捕まえられるかの検証
        ResidencyManager.shared.startIfEnabled()

        // 充電遷移の検出(アプリが開かれた瞬間のスナップショットからも拾う)
        let snapshot = DeviceTelemetry.snapshot()
        if let charging = DeviceTelemetry.detectChargingTransition(current: snapshot) {
            await SignalQueue.shared.append(charging)
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        AuthManager.shared.configure()

        // BGTaskScheduler の登録
        BGTaskScheduler.shared.register(forTaskWithIdentifier: MimamoriConstants.bgSignalSyncTaskId, using: nil) { task in
            handleBackgroundSync(task as! BGAppRefreshTask)
        }
        scheduleBackgroundSync()

        // 通知カテゴリ: checkin_request 通知に「元気です」アクションを付ける。
        // options を空にすることでアプリを開かずバックグラウンドで応答できる。
        let reportAlive = UNNotificationAction(
            identifier: MimamoriConstants.reportAliveActionId,
            title: "元気です",
            options: [],
        )
        let checkinCategory = UNNotificationCategory(
            identifier: MimamoriConstants.checkinCategoryId,
            actions: [reportAlive],
            intentIdentifiers: [],
            options: [],
        )
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.setNotificationCategories([checkinCategory])
        center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in
            DispatchQueue.main.async { application.registerForRemoteNotifications() }
        }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        // トークン発行はログインより先に起きるため、App Group に保留してから登録を試みる
        UserDefaults(suiteName: MimamoriConstants.appGroup)?
            .set(token, forKey: MimamoriConstants.pendingPushTokenKey)
        Task { @MainActor in
            await AuthManager.shared.registerDeviceIfPossible()
        }
    }

    // MARK: - UNUserNotificationCenterDelegate

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        let kind = notification.request.content.userInfo["kind"] as? String
        // widget_refresh は Widget 更新が目的の passive 通知なので前面では出さない
        if kind == "widget_refresh" { return [] }
        return [.banner, .sound]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let kind = response.notification.request.content.userInfo["kind"] as? String

        // 「元気です」アクション、または checkin_request 通知本体のタップは
        // どちらも生存応答として扱う
        let isReportAliveAction = response.actionIdentifier == MimamoriConstants.reportAliveActionId
        let isCheckinTap = response.actionIdentifier == UNNotificationDefaultActionIdentifier && kind == "checkin_request"
        if isReportAliveAction || isCheckinTap {
            await SignalQueue.shared.append(Signal(type: SignalType.checkinTap, meta: ["src": "notification"]))
            let sent = await SignalFlusher.flush()
            if sent {
                WidgetContentStore.recordCheckin()
            }
        }
    }
}

private func handleBackgroundSync(_ task: BGAppRefreshTask) {
    scheduleBackgroundSync()
    let op = Task {
        // ロック解除中なら unlock_probe を記録
        if LockStateProbe.isDeviceUnlocked() == true {
            await SignalQueue.shared.append(Signal(type: SignalType.unlockProbe))
        }
        // 歩数も取得(権限ダイアログは出さない)
        await PedometerManager.shared.collectAndEnqueue(allowPrompt: false)
        await SignalFlusher.flush()
        // Widget 表示を更新し、未通知の新着メッセージがあればローカル通知
        // (push 不達時のフォールバック経路)
        if let newMessage = await WidgetContentStore.refreshFromServer() {
            NotificationPlanner.notifyNewMessage(newMessage)
        }
        // 最新の天気で毎朝の天気通知を予約し直す
        NotificationPlanner.scheduleMorningWeather()
        task.setTaskCompleted(success: true)
    }
    task.expirationHandler = { op.cancel() }
}

private func scheduleBackgroundSync() {
    let request = BGAppRefreshTaskRequest(identifier: MimamoriConstants.bgSignalSyncTaskId)
    request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60)
    try? BGTaskScheduler.shared.submit(request)
}
