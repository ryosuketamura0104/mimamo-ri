import Foundation

/// SignalQueue の内容をサーバーにまとめて送る。
/// 失敗時はキューに戻して次回リトライ。
public enum SignalFlusher {
    /// - Returns: 送信に成功したか(キューが空だった場合も true)。
    @discardableResult
    public static func flush(client: APIClient = APIClient()) async -> Bool {
        let queued = await SignalQueue.shared.drain()
        if queued.isEmpty { return true }
        do {
            _ = try await client.postSignals(queued)
            return true
        } catch {
            // 失敗したら書き戻す。drain 後に別プロセスが積んだ分が先頭に来るため
            // 厳密な FIFO ではないが、サーバー側は observedAt で解釈するので問題ない。
            await SignalQueue.shared.appendMany(queued)
            return false
        }
    }
}
