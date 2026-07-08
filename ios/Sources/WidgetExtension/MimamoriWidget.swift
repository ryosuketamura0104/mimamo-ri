import AppIntents
import MimamoriKit
import SwiftUI
import WidgetKit

/// Widget: 天気/メッセージ表示 + タイムライン更新時に unlock_probe 記録 + 「元気です」ボタン。
struct MimamoriWidget: Widget {
    let kind = "com.crouton.mimamori.WidgetExtension"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MimamoriTimelineProvider()) { entry in
            MimamoriWidgetView(entry: entry)
        }
        .configurationDisplayName("mimamo-ri")
        .description("天気とメッセージを表示")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct MimamoriEntry: TimelineEntry {
    let date: Date
    let title: String
    let body: String
}

struct MimamoriTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> MimamoriEntry {
        MimamoriEntry(date: Date(), title: "mimamo-ri", body: "今日も元気に")
    }

    func getSnapshot(in context: Context, completion: @escaping (MimamoriEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MimamoriEntry>) -> Void) {
        // タイムライン更新のタイミングで生存プローブを記録
        Task {
            if LockStateProbe.isDeviceUnlocked() == true {
                await SignalQueue.shared.append(Signal(type: SignalType.unlockProbe))
            }
            await SignalQueue.shared.append(Signal(type: SignalType.widgetProbe))
        }
        // 実際の表示コンテンツは App Group の共有 UserDefaults から取得
        let defaults = UserDefaults(suiteName: MimamoriConstants.appGroup)
        let title = defaults?.string(forKey: "widget_title") ?? "mimamo-ri"
        let body = defaults?.string(forKey: "widget_body") ?? "今日も元気に過ごしましょう"
        let entry = MimamoriEntry(date: Date(), title: title, body: body)
        // 次回更新は 30 分後を目安に(OS 判断で前後する)
        let next = Date().addingTimeInterval(30 * 60)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct MimamoriWidgetView: View {
    let entry: MimamoriEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(entry.title).font(.caption).foregroundStyle(.secondary)
            Text(entry.body).font(.title3).bold()
            Spacer()
            Button(intent: ReportAliveIntent()) {
                Label("元気です", systemImage: "hand.thumbsup")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
        .containerBackground(.background, for: .widget)
    }
}

@main
struct MimamoriWidgetBundle: WidgetBundle {
    var body: some Widget {
        MimamoriWidget()
    }
}

/// Widget 上のボタン用 App Intent。アプリを開かずに checkin API を叩く。
struct ReportAliveIntent: AppIntent {
    static var title: LocalizedStringResource = "元気です"
    func perform() async throws -> some IntentResult {
        await SignalQueue.shared.append(Signal(type: SignalType.checkinTap))
        await SignalFlusher.flush()
        return .result()
    }
}
