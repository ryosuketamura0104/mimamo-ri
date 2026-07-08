import BackgroundTasks
import MimamoriKit
import SwiftUI
import UserNotifications

@main
struct MimamoriApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate

    var body: some Scene {
        WindowGroup {
            RootView()
                .task {
                    // ロック解除中に一度だけ保護ファイルを作成
                    LockStateProbe.ensureProbeFile()
                    // App Open シグナルを記録
                    await SignalQueue.shared.append(Signal(type: SignalType.appOpen))
                    await SignalFlusher.flush()
                }
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        // BGTaskScheduler の登録
        BGTaskScheduler.shared.register(forTaskWithIdentifier: MimamoriConstants.bgSignalSyncTaskId, using: nil) { task in
            handleBackgroundSync(task as! BGAppRefreshTask)
        }
        scheduleBackgroundSync()
        // APNs 登録
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in
            DispatchQueue.main.async { application.registerForRemoteNotifications() }
        }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task {
            let client = APIClient()
            try? await client.registerDevice(pushToken: token, appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String, osVersion: UIDevice.current.systemVersion)
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
        await SignalFlusher.flush()
        task.setTaskCompleted(success: true)
    }
    task.expirationHandler = { op.cancel() }
}

private func scheduleBackgroundSync() {
    let request = BGAppRefreshTaskRequest(identifier: MimamoriConstants.bgSignalSyncTaskId)
    request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60)
    try? BGTaskScheduler.shared.submit(request)
}
