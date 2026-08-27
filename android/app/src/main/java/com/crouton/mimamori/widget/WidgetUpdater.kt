package com.crouton.mimamori.widget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.appwidget.updateAll
import com.crouton.mimamori.api.ApiClient

/**
 * Widget の表示内容(見守る側からの最新メッセージ)をサーバーから取得して反映する。
 * UsageSyncWorker の定期実行と FCM の widget_refresh の両方から呼ばれる。
 * 天気表示は位置情報が未実装のため未対応(メッセージのみ)。
 */
object WidgetUpdater {

    /** 最新メッセージを取得し、配置済みの全 Widget の Preferences に書き込んで再描画する。 */
    suspend fun refreshLatestMessage(context: Context, api: ApiClient) {
        val latest = api.getMyMessages(limit = 1).messages.firstOrNull() ?: return
        val glanceIds = GlanceAppWidgetManager(context).getGlanceIds(MimamoriWidget::class.java)
        for (glanceId in glanceIds) {
            updateAppWidgetState(context, glanceId) { prefs ->
                prefs[MimamoriWidget.KEY_TITLE] = "家族からのメッセージ"
                prefs[MimamoriWidget.KEY_BODY] = latest.body
            }
        }
        MimamoriWidget().updateAll(context)
    }
}
