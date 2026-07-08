package com.crouton.mimamori

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import androidx.work.Configuration
import androidx.work.WorkManager
import com.crouton.mimamori.work.scheduleUsageSyncWorker

/**
 * mimamo-ri Android アプリケーションのエントリポイント。
 * 起動時に通知チャンネル作成と、UsageStats 定期同期の WorkManager を初期化する。
 */
class MimamoriApp : Application(), Configuration.Provider {

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().build()

    override fun onCreate() {
        super.onCreate()
        setupNotificationChannels()
        WorkManager.getInstance(this)
        scheduleUsageSyncWorker(this)
    }

    private fun setupNotificationChannels() {
        val nm = getSystemService(NotificationManager::class.java) ?: return
        // 本人確認・アラート用
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_CHECKIN,
                "見守り通知",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "本人確認 / 見守り対象の異常アラート"
            }
        )
        // Widget 更新やメッセージなど
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_MESSAGE,
                "メッセージ",
                NotificationManager.IMPORTANCE_LOW,
            )
        )
    }

    companion object {
        const val CHANNEL_CHECKIN = "checkin"
        const val CHANNEL_MESSAGE = "message"
    }
}
