import AppIntents
import MimamoriKit
import SwiftUI
import WidgetKit

/// Widget: メッセージ表示 + 「元気です」ボタン + アプリ起動導線。
///
/// 「アプリを開かれない前提」における Widget の役割は表示だけではない:
///   - タイムライン更新のたびに widget_probe / unlock_probe を記録し、
///     滞留分の送信も試みる(端末が使われている限りシグナルが流れ続ける)
///   - 本体タップは widgetURL 経由でアプリを開く導線になり、
///     「開かれた」実績を作って iOS の自動オフロードを遠ざける
struct MimamoriWidget: Widget {
    let kind = "com.crouton.mimamori.WidgetExtension"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MimamoriTimelineProvider()) { entry in
            MimamoriWidgetView(entry: entry)
        }
        .configurationDisplayName("mimamo-ri")
        .description("家族からのメッセージを表示")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct MimamoriEntry: TimelineEntry {
    let date: Date
    let title: String
    let body: String
    let lastCheckinAt: Date?
}

struct MimamoriTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> MimamoriEntry {
        MimamoriEntry(date: Date(), title: "mimamo-ri", body: "今日も元気に", lastCheckinAt: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (MimamoriEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MimamoriEntry>) -> Void) {
        // タイムライン更新のタイミングで生存プローブを記録し、送信も試みる。
        // 送信失敗時はキューに残るだけなので、ここでは結果を待たなくてよい。
        Task {
            if LockStateProbe.isDeviceUnlocked() == true {
                await SignalQueue.shared.append(Signal(type: SignalType.unlockProbe))
            }
            await SignalQueue.shared.append(Signal(type: SignalType.widgetProbe))
            await SignalFlusher.flush()
        }
        let content = WidgetContentStore.read()
        let entry = MimamoriEntry(
            date: Date(),
            title: content.title,
            body: content.body,
            lastCheckinAt: WidgetContentStore.lastCheckinAt,
        )
        // 次回更新は 30 分後を目安に(OS 判断で前後する)
        let next = Date().addingTimeInterval(30 * 60)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct MimamoriWidgetView: View {
    let entry: MimamoriEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(entry.title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.brand)
            Text(entry.body)
                .font(.title3.weight(.semibold))
                .lineLimit(2)
            Spacer()
            Button(intent: ReportAliveIntent()) {
                Label("元気です", systemImage: "hand.thumbsup.fill")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.borderedProminent)
            .tint(.brand)
            if let at = entry.lastCheckinAt {
                Text("前回: \(at.formatted(.dateTime.month().day().hour().minute()))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
        // ボタン以外の領域タップでアプリを開く(起動導線)
        .widgetURL(URL(string: "\(MimamoriConstants.deepLinkScheme)://open?src=widget"))
    }
}

@main
struct MimamoriWidgetBundle: WidgetBundle {
    var body: some Widget {
        MimamoriWidget()
    }
}

/// Widget 上のボタン用 App Intent。アプリを開かずに生存応答を送る。
struct ReportAliveIntent: AppIntent {
    static var title: LocalizedStringResource = "元気です"

    func perform() async throws -> some IntentResult {
        await SignalQueue.shared.append(Signal(type: SignalType.checkinTap, meta: ["src": "widget"]))
        let sent = await SignalFlusher.flush()
        if sent {
            WidgetContentStore.recordCheckin()
        }
        return .result()
    }
}
