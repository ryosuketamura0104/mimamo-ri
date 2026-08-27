package com.crouton.mimamori.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.crouton.mimamori.api.ApiClient
import com.crouton.mimamori.auth.FirebaseAuthProvider
import com.crouton.mimamori.signal.UsageStatsCollector
import com.crouton.mimamori.widget.WidgetUpdater
import java.util.concurrent.TimeUnit

/**
 * UsageStatsCollector で収集したシグナルを定期的にサーバーへ送信する。
 * あわせて Widget 表示用の最新メッセージも取得・反映する。
 * FCM 高優先度データメッセージからも起床可能。
 */
class UsageSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val auth = FirebaseAuthProvider()
        if (auth.currentUserId() == null) return Result.success() // 未ログインなら次回まで待機
        val api = ApiClient(auth)
        return try {
            val collected = UsageStatsCollector.collectSince(applicationContext)
            if (collected != null) {
                if (collected.signals.isNotEmpty()) {
                    api.postSignals(collected.signals)
                }
                // 送信成功後にのみウォーターマークを確定する(失敗時は次回再収集)
                UsageStatsCollector.commitSyncedUntil(applicationContext, collected.syncedUntil)
            }
            // Widget 更新の失敗はシグナル送信の成否に影響させない
            runCatching { WidgetUpdater.refreshLatestMessage(applicationContext, api) }
            Result.success()
        } catch (t: Throwable) {
            Result.retry()
        } finally {
            api.close()
        }
    }
}

private const val WORK_NAME = "usage_sync"

fun scheduleUsageSyncWorker(context: Context, intervalMinutes: Long = 30L) {
    val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
    val req = PeriodicWorkRequestBuilder<UsageSyncWorker>(intervalMinutes, TimeUnit.MINUTES)
        .setConstraints(constraints)
        .build()
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        WORK_NAME,
        ExistingPeriodicWorkPolicy.KEEP,
        req,
    )
}
