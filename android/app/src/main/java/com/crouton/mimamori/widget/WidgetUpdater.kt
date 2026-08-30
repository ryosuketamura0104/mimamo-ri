package com.crouton.mimamori.widget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.appwidget.updateAll
import com.crouton.mimamori.api.ApiClient
import com.crouton.mimamori.api.MessageDto
import com.crouton.mimamori.api.WeatherDto
import kotlin.math.roundToInt

/**
 * Widget の表示内容(見守る側からの最新メッセージ + 天気サマリ)をサーバーから取得して反映する。
 * UsageSyncWorker の定期実行と FCM の widget_refresh の両方から呼ばれる。
 */
object WidgetUpdater {

    // TODO: 見守られる側の位置情報取得を実装するまで座標は東京駅付近に固定する
    private const val FIXED_LAT = 35.6812
    private const val FIXED_LNG = 139.7671

    /**
     * 最新メッセージと天気を取得し、配置済みの全 Widget の Preferences に書き込んで再描画する。
     * 天気の取得失敗は握り潰し、メッセージだけでも更新する。
     *
     * @return 取得できた最新メッセージ(呼び出し元の新着通知判定用)。なければ null
     */
    suspend fun refreshWidget(context: Context, api: ApiClient): MessageDto? {
        val latest = api.getMyMessages(limit = 1).messages.firstOrNull()
        val weatherText = runCatching {
            formatWeather(api.getWeather(FIXED_LAT, FIXED_LNG).weather)
        }.getOrNull()
        if (latest == null && weatherText == null) return null

        val glanceIds = GlanceAppWidgetManager(context).getGlanceIds(MimamoriWidget::class.java)
        for (glanceId in glanceIds) {
            updateAppWidgetState(context, glanceId) { prefs ->
                if (latest != null) {
                    prefs[MimamoriWidget.KEY_TITLE] = "家族からのメッセージ"
                    prefs[MimamoriWidget.KEY_BODY] = latest.body
                }
                if (weatherText != null) {
                    prefs[MimamoriWidget.KEY_WEATHER] = weatherText
                }
            }
        }
        MimamoriWidget().updateAll(context)
        return latest
    }

    /** サーバーの天気レスポンスを Widget 表示用の短い文字列(例「晴れ 28度」)へ整形する。 */
    private fun formatWeather(weather: WeatherDto): String {
        val label = when (weather.condition) {
            "sunny", "clear" -> "晴れ"
            "cloudy" -> "くもり"
            "rain", "rainy" -> "雨"
            "snow", "snowy" -> "雪"
            else -> weather.condition
        }
        return "$label ${weather.temperatureC.roundToInt()}度"
    }
}
