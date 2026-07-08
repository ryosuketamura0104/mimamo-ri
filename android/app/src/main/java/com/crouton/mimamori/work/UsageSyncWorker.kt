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
import java.util.concurrent.TimeUnit

/**
 * UsageStatsCollector で収集したシグナルを定期的にサーバーへ送信する。
 * FCM 高優先度データメッセージからも起床可能。
 */
class UsageSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val auth = FirebaseAuthProvider()
        if (auth.currentUserId() == null) return Result.success() // 未ログインなら次回まで待機
        val api = ApiClient(auth)
        return try {
            val signals = UsageStatsCollector.collectSince(applicationContext)
            if (signals.isNotEmpty()) {
                api.postSignals(signals)
            }
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
