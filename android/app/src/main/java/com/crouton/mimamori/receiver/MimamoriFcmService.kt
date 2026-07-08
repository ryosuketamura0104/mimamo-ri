package com.crouton.mimamori.receiver

import android.app.NotificationManager
import androidx.core.app.NotificationCompat
import com.crouton.mimamori.MimamoriApp
import com.crouton.mimamori.R
import com.crouton.mimamori.api.ApiClient
import com.crouton.mimamori.auth.FirebaseAuthProvider
import com.crouton.mimamori.signal.UsageStatsCollector
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * FCM 受信サービス。
 * data.kind に応じて分岐:
 *   - "widget_refresh" : Widget を再描画するデータ
 *   - "checkin_request": 「元気ですか？」通知を表示
 *   - "watcher_alert"  : 見守る側向けアラート
 * どのケースでも直前に UsageStats をサーバーへ吸い上げる(高優先度データメッセージは Doze 突破する)。
 */
class MimamoriFcmService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        val auth = FirebaseAuthProvider()
        if (auth.currentUserId() == null) return
        val api = ApiClient(auth)
        CoroutineScope(Dispatchers.IO).launch {
            runCatching { api.registerDevice(token) }
            api.close()
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val kind = data["kind"] ?: return

        // シグナル吸い上げ
        val auth = FirebaseAuthProvider()
        if (auth.currentUserId() != null) {
            val api = ApiClient(auth)
            CoroutineScope(Dispatchers.IO).launch {
                runCatching {
                    val signals = UsageStatsCollector.collectSince(applicationContext)
                    if (signals.isNotEmpty()) api.postSignals(signals)
                }
                api.close()
            }
        }

        when (kind) {
            "checkin_request" -> showNotification(
                MimamoriApp.CHANNEL_CHECKIN,
                title = "元気ですか？",
                body = "アプリを開いて「元気です」を教えてください",
            )
            "watcher_alert" -> showNotification(
                MimamoriApp.CHANNEL_CHECKIN,
                title = message.notification?.title ?: "見守り対象からの応答がありません",
                body = message.notification?.body ?: "確認をお願いします",
            )
            "widget_refresh" -> {
                // Widget の再描画は Widget 側の onEnabled/scheduled から
                // TODO: GlanceAppWidget の update をここでトリガーする
            }
        }
    }

    private fun showNotification(channel: String, title: String, body: String) {
        val nm = getSystemService(NotificationManager::class.java) ?: return
        val n = NotificationCompat.Builder(this, channel)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .build()
        nm.notify(System.currentTimeMillis().toInt(), n)
    }
}
