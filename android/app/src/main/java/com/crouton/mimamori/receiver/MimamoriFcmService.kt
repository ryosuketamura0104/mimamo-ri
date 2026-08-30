package com.crouton.mimamori.receiver

import android.app.NotificationManager
import androidx.core.app.NotificationCompat
import com.crouton.mimamori.MimamoriApp
import com.crouton.mimamori.R
import com.crouton.mimamori.api.ApiClient
import com.crouton.mimamori.auth.FirebaseAuthProvider
import com.crouton.mimamori.push.PushTokenRegistrar
import com.crouton.mimamori.signal.UsageStatsCollector
import com.crouton.mimamori.widget.WidgetUpdater
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
        // ログイン前の発火では登録されない。ログイン確立時に MainActivity 側で再登録される
        CoroutineScope(Dispatchers.IO).launch {
            runCatching { PushTokenRegistrar.registerToken(token) }
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
                    val collected = UsageStatsCollector.collectSince(applicationContext)
                    if (collected != null) {
                        if (collected.signals.isNotEmpty()) api.postSignals(collected.signals)
                        // 送信成功後にのみウォーターマークを確定する(失敗時は次回再収集)
                        UsageStatsCollector.commitSyncedUntil(applicationContext, collected.syncedUntil)
                    }
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
                if (auth.currentUserId() != null) {
                    val api = ApiClient(auth)
                    CoroutineScope(Dispatchers.IO).launch {
                        runCatching { WidgetUpdater.refreshWidget(applicationContext, api) }
                        api.close()
                    }
                }
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
