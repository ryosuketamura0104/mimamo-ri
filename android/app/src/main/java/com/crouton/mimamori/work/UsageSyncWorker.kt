package com.crouton.mimamori.work

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.work.CoroutineWorker
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.crouton.mimamori.MainActivity
import com.crouton.mimamori.MimamoriApp
import com.crouton.mimamori.api.ApiClient
import com.crouton.mimamori.api.MessageDto
import com.crouton.mimamori.auth.FirebaseAuthProvider
import com.crouton.mimamori.signal.UsageStatsCollector
import com.crouton.mimamori.signal.signalPrefs
import com.crouton.mimamori.widget.WidgetUpdater
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.first

/**
 * UsageStatsCollector で収集したシグナルを定期的にサーバーへ送信する。
 * あわせて Widget 表示用の最新メッセージ + 天気も取得・反映し、
 * 新着メッセージがあれば FCM 不達時のフォールバックとしてローカル通知を出す。
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
            val latestMessage = runCatching { WidgetUpdater.refreshWidget(applicationContext, api) }.getOrNull()
            if (latestMessage != null) {
                runCatching { notifyNewMessageIfNeeded(latestMessage) }
            }
            Result.success()
        } catch (t: Throwable) {
            Result.retry()
        } finally {
            api.close()
        }
    }

    /**
     * FCM が届かなかった場合のフォールバック。
     * 前回通知済みの id と異なる最新メッセージが取得できたらローカル通知を出す。
     */
    private suspend fun notifyNewMessageIfNeeded(message: MessageDto) {
        val prefs = applicationContext.signalPrefs.data.first()
        if (prefs[LAST_NOTIFIED_MESSAGE_ID_KEY] == message.id) return

        if (canPostNotifications()) {
            val intent = Intent(applicationContext, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                applicationContext,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val notification = NotificationCompat.Builder(applicationContext, MimamoriApp.CHANNEL_MESSAGE)
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setContentTitle("家族からのメッセージ")
                .setContentText(message.body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message.body))
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()
            NotificationManagerCompat.from(applicationContext).notify(NOTIFICATION_ID_NEW_MESSAGE, notification)
        }
        // POST_NOTIFICATIONS 未許可で黙ってスキップした場合も id は保存し、
        // 後から許可された際に古いメッセージを通知しないようにする
        applicationContext.signalPrefs.edit { it[LAST_NOTIFIED_MESSAGE_ID_KEY] = message.id }
    }

    /** POST_NOTIFICATIONS(API 33+)と通知全体の有効状態を確認する。 */
    private fun canPostNotifications(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                applicationContext,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return false
        }
        return NotificationManagerCompat.from(applicationContext).areNotificationsEnabled()
    }

    companion object {
        /** 最後にローカル通知した メッセージ id(mimamori_signals DataStore 内) */
        private val LAST_NOTIFIED_MESSAGE_ID_KEY = stringPreferencesKey("last_notified_message_id")
        private const val NOTIFICATION_ID_NEW_MESSAGE = 2001
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
