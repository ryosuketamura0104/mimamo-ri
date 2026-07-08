import Foundation

/// SignalQueue の内容をサーバーにまとめて送る。
/// 失敗時はキューに戻して次回リトライ。
public enum SignalFlusher {
    public static func flush(client: APIClient = APIClient()) async {
        let queued = await SignalQueue.shared.drain()
        if queued.isEmpty { return }
        do {
            _ = try await client.postSignals(queued)
        } catch {
            // 失敗したら書き戻す(FIFO 順を保つため先頭に戻す)
            await SignalQueue.shared.appendMany(queued)
        }
    }
}
