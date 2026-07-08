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

private val Context.signalPrefs by preferencesDataStore("mimamori_signals")

private val LAST_SYNC_KEY = longPreferencesKey("last_usage_sync_epoch_ms")

/**
 * UsageStatsManager から画面ON/ロック解除/アプリforeground イベントを取得し、
 * 前回同期以降の差分を SignalReport に変換する。
 *
 * PACKAGE_USAGE_STATS 権限が必要。未付与なら空リストを返す。
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

    suspend fun collectSince(context: Context, now: Instant = Instant.now()): List<SignalReport> {
        if (!hasPermission(context)) return emptyList()
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
        context.signalPrefs.edit { it[LAST_SYNC_KEY] = now.toEpochMilli() }
        return result
    }
}
