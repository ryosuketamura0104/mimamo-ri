import AppIntents
import MimamoriKit

/// Siri / Spotlight / ショートカット App から「元気です」を実行できるようにする。
/// アプリを開かずに生存応答できる経路を増やすのが目的。
struct ReportAliveAppIntent: AppIntent {
    static var title: LocalizedStringResource = "元気です"
    static var description = IntentDescription("家族に元気であることを伝えます")

    func perform() async throws -> some IntentResult & ProvidesDialog {
        await SignalQueue.shared.append(Signal(type: SignalType.checkinTap, meta: ["src": "shortcut"]))
        let sent = await SignalFlusher.flush()
        if sent {
            WidgetContentStore.recordCheckin()
            return .result(dialog: "家族に伝えました")
        }
        return .result(dialog: "あとでもう一度お試しください")
    }
}

struct MimamoriAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ReportAliveAppIntent(),
            phrases: [
                "\(.applicationName)で元気ですと伝えて",
                "\(.applicationName)に元気と伝えて",
            ],
            shortTitle: "元気です",
            systemImageName: "hand.thumbsup",
        )
    }
}
