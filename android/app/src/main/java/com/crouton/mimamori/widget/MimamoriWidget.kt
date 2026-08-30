package com.crouton.mimamori.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.glance.Button
import androidx.glance.ButtonDefaults
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import com.crouton.mimamori.MainActivity
import com.crouton.mimamori.api.ApiClient
import com.crouton.mimamori.auth.FirebaseAuthProvider
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Glance で実装した Widget。
 * 表示内容(天気サマリ / 見守る側からのメッセージ / 前回チェックイン時刻)は Preferences 経由で更新する。
 * 「元気です」ボタンで能動チェックインをサーバーへ送信できる。
 */
class MimamoriWidget : GlanceAppWidget() {

    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    companion object {
        val KEY_TITLE = stringPreferencesKey("widget_title")
        val KEY_BODY = stringPreferencesKey("widget_body")

        /** 天気サマリ(例「晴れ 28度」)。未取得なら非表示 */
        val KEY_WEATHER = stringPreferencesKey("widget_weather")

        /** 前回チェックイン時刻(エポック秒の文字列)。未チェックインなら非表示 */
        val KEY_LAST_CHECKIN = stringPreferencesKey("widget_last_checkin")
    }

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { WidgetContent() }
    }

    @Composable
    private fun WidgetContent() {
        val prefs = currentState<Preferences>()
        val title = prefs[KEY_TITLE] ?: "mimamo-ri"
        val body = prefs[KEY_BODY] ?: "今日も元気に過ごしましょう"
        val weather = prefs[KEY_WEATHER]
        val lastCheckinEpochSec = prefs[KEY_LAST_CHECKIN]?.toLongOrNull()

        // ブランドカラー(深いエメラルドグリーン)。ライト/ダークで背景を切り替える
        val brandColor = ColorProvider(day = Color(0xFF047857), night = Color(0xFF34D399))
        val subColor = ColorProvider(day = Color(0xFF5B6B63), night = Color(0xFF9DB2A8))

        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(ColorProvider(day = Color(0xFFF6FBF8), night = Color(0xFF132019)))
                .padding(14.dp)
                // 余白部のタップでアプリ本体を起動する
                .clickable(actionStartActivity<MainActivity>()),
            verticalAlignment = Alignment.Vertical.CenterVertically,
            horizontalAlignment = Alignment.Horizontal.CenterHorizontally,
        ) {
            if (weather != null) {
                Text(
                    text = weather,
                    style = TextStyle(fontSize = 11.sp, color = subColor),
                )
                Spacer(GlanceModifier.height(2.dp))
            }
            Text(
                text = title,
                style = TextStyle(
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    color = brandColor,
                ),
            )
            Text(
                text = body,
                style = TextStyle(
                    fontSize = 16.sp,
                    color = ColorProvider(day = Color(0xFF0F1F1A), night = Color(0xFFDCE7E1)),
                ),
            )
            Spacer(GlanceModifier.height(8.dp))
            Button(
                text = "元気です",
                onClick = actionRunCallback<ReportAliveAction>(),
                colors = ButtonDefaults.buttonColors(
                    backgroundColor = brandColor,
                    contentColor = ColorProvider(day = Color.White, night = Color.White),
                ),
            )
            if (lastCheckinEpochSec != null) {
                Spacer(GlanceModifier.height(4.dp))
                Text(
                    text = "前回: ${formatCheckinTime(lastCheckinEpochSec)}",
                    style = TextStyle(fontSize = 11.sp, color = subColor),
                )
            }
        }
    }

    /** エポック秒を端末タイムゾーンの「M/d HH:mm」表記へ整形する。 */
    private fun formatCheckinTime(epochSec: Long): String =
        DateTimeFormatter.ofPattern("M/d HH:mm")
            .withZone(ZoneId.systemDefault())
            .format(Instant.ofEpochSecond(epochSec))
}

/**
 * Widget の「元気です」ボタンから起動され、能動チェックインをサーバーへ送信する。
 * 成功時は前回チェックイン時刻を保存して全 Widget を再描画する。未ログイン時は何もしない。
 */
class ReportAliveAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val auth = FirebaseAuthProvider()
        if (auth.currentUserId() == null) return
        val api = ApiClient(auth)
        try {
            runCatching { api.checkin() }.onSuccess {
                val epochSec = (System.currentTimeMillis() / 1000L).toString()
                val manager = GlanceAppWidgetManager(context)
                for (id in manager.getGlanceIds(MimamoriWidget::class.java)) {
                    updateAppWidgetState(context, id) { prefs ->
                        prefs[MimamoriWidget.KEY_LAST_CHECKIN] = epochSec
                    }
                }
                MimamoriWidget().updateAll(context)
            }
        } finally {
            api.close()
        }
    }
}

class MimamoriWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = MimamoriWidget()
}
