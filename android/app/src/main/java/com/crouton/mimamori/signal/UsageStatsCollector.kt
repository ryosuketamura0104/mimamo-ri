package com.crouton.mimamori.signal

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Process
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import com.crouton.mimamori.api.SignalReport
import java.time.Instant
import kotlinx.coroutines.flow.first

// UsageSyncWorker の新着メッセージ通知判定でも同じ DataStore を共有するため internal 公開
internal val Context.signalPrefs by preferencesDataStore("mimamori_signals")

private val LAST_SYNC_KEY = longPreferencesKey("last_usage_sync_epoch_ms")

/**
 * 収集結果。signals の送信成功後に syncedUntil を commitSyncedUntil で確定させる。
 */
data class CollectedSignals(
    val signals: List<SignalReport>,
    val syncedUntil: Instant,
)

/**
 * UsageStatsManager から画面ON/ロック解除/アプリforeground イベントを取得し、
 * 前回同期以降の差分を SignalReport に変換する。
 *
 * PACKAGE_USAGE_STATS 権限が必要。未付与なら null を返す。
 * 収集(collectSince)とウォーターマーク確定(commitSyncedUntil)は分離しており、
 * 送信失敗時に確定しなければ同区間は次回再クエリされる(UsageStats は OS 側に履歴が残る)。
 */
object UsageStatsCollector {

    fun hasPermission(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName,
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    /**
     * 前回確定済みウォーターマーク以降のイベントを収集する。ここではウォーターマークを進めない。
     * postSignals 成功後に commitSyncedUntil(syncedUntil) を呼ぶこと。
     */
    suspend fun collectSince(context: Context, now: Instant = Instant.now()): CollectedSignals? {
        if (!hasPermission(context)) return null
        val prefs = context.signalPrefs.data.first()
        val lastMs = prefs[LAST_SYNC_KEY] ?: (now.toEpochMilli() - 6 * 3600_000L)
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val events = usm.queryEvents(lastMs, now.toEpochMilli())
        val result = mutableListOf<SignalReport>()
        val ev = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(ev)
            val type = when (ev.eventType) {
                UsageEvents.Event.SCREEN_INTERACTIVE -> "screen_time"
                UsageEvents.Event.KEYGUARD_HIDDEN -> "unlock_probe"
                UsageEvents.Event.ACTIVITY_RESUMED -> "usage_stats"
                else -> null
            } ?: continue
            result += SignalReport(
                type = type,
                observedAt = Instant.ofEpochMilli(ev.timeStamp).toString(),
                meta = if (type == "usage_stats") mapOf("package" to (ev.packageName ?: "")) else null,
            )
        }
        // 冪等: 同一時刻の重複はサーバー側で dedup されるため、そのまま送信
        return CollectedSignals(signals = result, syncedUntil = now)
    }

    /**
     * ウォーターマークを確定する。postSignals 成功後にのみ呼ぶこと。
     * 呼ばなければ同区間のシグナルは次回の collectSince で再収集される。
     */
    suspend fun commitSyncedUntil(context: Context, until: Instant) {
        context.signalPrefs.edit { it[LAST_SYNC_KEY] = until.toEpochMilli() }
    }
}
