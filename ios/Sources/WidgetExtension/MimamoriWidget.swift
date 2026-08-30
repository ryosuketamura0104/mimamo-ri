import AppIntents
import MimamoriKit
import SwiftUI
import WidgetKit

/// Widget: メッセージ/天気の表示 + 「元気です」「読んだよ」ボタン + アプリ起動導線。
///
/// 「アプリを開かれない前提」における Widget の役割は表示だけではない:
///   - getTimeline の実行そのものを生存プローブとして記録し、滞留分も送信する
///     (ホーム画面が表示される=端末が使われている、をシグナル化する)
///   - getTimeline 内でサーバーからメッセージ・天気を取得するので、
///     アプリ本体を開かなくても表示が自力で最新化される
///   - ボタンでアプリを開かず応答(生存確認+既読)
///   - 本体タップは widgetURL でアプリ起動導線になり、オフロードを遠ざける
///   - ロック画面(accessory 系)にも置けるため「毎日必ず見る場所」を確保できる
struct MimamoriWidget: Widget {
    let kind = "com.crouton.mimamori.WidgetExtension"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MimamoriTimelineProvider()) { entry in
            MimamoriWidgetView(entry: entry)
        }
        .configurationDisplayName("mimamo-ri")
        .description("家族からのメッセージと天気を表示")
        .supportedFamilies([
            .systemSmall, .systemMedium,
            .accessoryInline, .accessoryRectangular, .accessoryCircular,
        ])
    }
}

struct MimamoriEntry: TimelineEntry {
    let date: Date
    let title: String
    let body: String
    let weatherLine: String?
    let lastCheckinAt: Date?
    let unreadMessageId: String?
}

struct MimamoriTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> MimamoriEntry {
        MimamoriEntry(date: Date(), title: "mimamo-ri", body: "今日も元気に", weatherLine: "晴れ 25度", lastCheckinAt: nil, unreadMessageId: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (MimamoriEntry) -> Void) {
        completion(makeEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MimamoriEntry>) -> Void) {
        Task {
            // タイムライン更新のタイミングで生存プローブを記録し、送信も試みる
            if LockStateProbe.isDeviceUnlocked() == true {
                await SignalQueue.shared.append(Signal(type: SignalType.unlockProbe))
            }
            await SignalQueue.shared.append(Signal(type: SignalType.widgetProbe))

            // Widget 自身がサーバーから最新表示を取得する(アプリを開かせない)。
            // reload=false 必須: ここで再読込を要求すると getTimeline が無限ループする
            await WidgetContentStore.refreshFromServer(reload: false)

            await SignalFlusher.flush()

            // 次回更新は 15 分後を目安に(OS 判断で前後する。更新予算は
            // 利用時間帯に偏る=それ自体が「使われている」シグナルになる)
            let next = Date().addingTimeInterval(15 * 60)
            completion(Timeline(entries: [makeEntry()], policy: .after(next)))
        }
    }

    private func makeEntry() -> MimamoriEntry {
        let content = WidgetContentStore.read()
        let unreadId: String?
        if let id = WidgetContentStore.latestMessageId, !WidgetContentStore.latestMessageRead {
            unreadId = id
        } else {
            unreadId = nil
        }
        return MimamoriEntry(
            date: Date(),
            title: content.title,
            body: content.body,
            weatherLine: WidgetContentStore.weatherLine,
            lastCheckinAt: WidgetContentStore.lastCheckinAt,
            unreadMessageId: unreadId,
        )
    }
}

struct MimamoriWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: MimamoriEntry

    var body: some View {
        Group {
            switch family {
            case .accessoryInline:
                inlineView
            case .accessoryRectangular:
                rectangularView
            case .accessoryCircular:
                circularView
            case .systemMedium:
                mediumView
            default:
                smallView
            }
        }
        // ボタン以外の領域タップでアプリを開く(起動導線)
        .widgetURL(URL(string: "\(MimamoriConstants.deepLinkScheme)://open?src=widget"))
    }

    // MARK: - ホーム画面

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let weather = entry.weatherLine {
                Text(weather)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Text(entry.title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.brand)
            Text(entry.body)
                .font(.headline)
                .lineLimit(2)
            Spacer()
            Button(intent: ReportAliveIntent()) {
                Label("元気です", systemImage: "hand.thumbsup.fill")
                    .font(.footnote.weight(.semibold))
            }
            .buttonStyle(.borderedProminent)
            .tint(.brand)
        }
        .padding(12)
        .containerBackground(.fill.tertiary, for: .widget)
    }

    private var mediumView: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                if let weather = entry.weatherLine {
                    Text(weather)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Text(entry.title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.brand)
                Text(entry.body)
                    .font(.title3.weight(.semibold))
                    .lineLimit(3)
                Spacer()
                if let at = entry.lastCheckinAt {
                    Text("前回の元気です: \(at.formatted(.dateTime.month().day().hour().minute()))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            VStack(spacing: 8) {
                Button(intent: ReportAliveIntent()) {
                    Label("元気です", systemImage: "hand.thumbsup.fill")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.brand)
                if let messageId = entry.unreadMessageId {
                    Button(intent: MarkMessageReadIntent(messageId: messageId)) {
                        Label("読んだよ", systemImage: "envelope.open")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(.brand)
                }
            }
            .frame(width: 132)
        }
        .padding(14)
        .containerBackground(.fill.tertiary, for: .widget)
    }

    // MARK: - ロック画面

    private var inlineView: some View {
        // ロック画面の1行スロット。天気を「毎日見る理由」として出す
        Text(entry.weatherLine.map { "\($0) mimamo-ri" } ?? "mimamo-ri 見守り中")
    }

    private var rectangularView: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: "heart.fill")
                Text(entry.weatherLine ?? "見守り中")
            }
            .font(.caption2.weight(.semibold))
            Text(entry.body)
                .font(.headline)
                .lineLimit(2)
        }
    }

    private var circularView: some View {
        VStack(spacing: 0) {
            Image(systemName: entry.unreadMessageId == nil ? "heart.fill" : "envelope.badge.fill")
                .font(.title3)
            Text(entry.unreadMessageId == nil ? "見守り" : "新着")
                .font(.caption2)
        }
    }
}

@main
struct MimamoriWidgetBundle: WidgetBundle {
    var body: some Widget {
        MimamoriWidget()
        if #available(iOSApplicationExtension 18.0, *) {
            ReportAliveControl()
        }
    }
}

/// コントロールセンターに置ける「元気です」ボタン(iOS 18+)。
/// ロック画面からもスワイプ1つで届く、最短の生存応答経路。
@available(iOSApplicationExtension 18.0, *)
struct ReportAliveControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.crouton.mimamori.control.report-alive") {
            ControlWidgetButton(action: ReportAliveIntent()) {
                Label("元気です", systemImage: "hand.thumbsup.fill")
            }
        }
        .displayName("元気です")
        .description("家族に元気であることを伝えます")
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

/// 「読んだよ」ボタン: メッセージ既読をサーバーへ返し、生存シグナルとしても記録する。
/// 見守る側は「届いた」ではなく「読まれた」を確認でき、安心が双方向になる。
struct MarkMessageReadIntent: AppIntent {
    static var title: LocalizedStringResource = "読んだよ"

    @Parameter(title: "メッセージID")
    var messageId: String

    init() {}

    init(messageId: String) {
        self.messageId = messageId
    }

    func perform() async throws -> some IntentResult {
        try? await APIClient().markMessageRead(id: messageId)
        await SignalQueue.shared.append(Signal(type: SignalType.checkinTap, meta: ["src": "message_read"]))
        await SignalFlusher.flush()
        WidgetContentStore.markLatestMessageRead()
        return .result()
    }
}
