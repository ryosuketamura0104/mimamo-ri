package com.crouton.mimamori.ui.screen

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.crouton.mimamori.api.ApiClient
import com.crouton.mimamori.auth.FirebaseAuthProvider
import com.crouton.mimamori.signal.UsageStatsCollector
import kotlinx.coroutines.launch

/**
 * ログイン後のホーム。
 * まずはロール共通の最小 UI: 使用状況アクセス案内、招待コード発行(watched向け)、
 * 生存応答(元気ですボタン)、ログアウト。
 */
@Composable
fun HomeScreen(onSignedOut: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val api = remember { ApiClient(FirebaseAuthProvider()) }
    var invitationCode by remember { mutableStateOf<String?>(null) }
    var checkinResult by remember { mutableStateOf<String?>(null) }
    var usageGranted by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        usageGranted = UsageStatsCollector.hasPermission(ctx)
    }

    Column(
        Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()),
    ) {
        Text("mimamo-ri", style = androidx.compose.material3.MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(16.dp))

        Card {
            Column(Modifier.padding(12.dp)) {
                Text("使用状況アクセス: ${if (usageGranted) "許可済み" else "未許可"}")
                Spacer(Modifier.height(8.dp))
                if (!usageGranted) {
                    Text("見守りに必要な権限です。設定画面から本アプリを許可してください。")
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { ctx.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) }) {
                        Text("使用状況アクセスの設定を開く")
                    }
                }
            }
        }
        Spacer(Modifier.height(16.dp))

        Card {
            Column(Modifier.padding(12.dp)) {
                Text("見守る家族に招待コードを渡す")
                Spacer(Modifier.height(8.dp))
                Button(onClick = {
                    scope.launch {
                        runCatching { api.createInvitation() }
                            .onSuccess { invitationCode = it.code }
                            .onFailure { invitationCode = "エラー: ${it.message}" }
                    }
                }) { Text("コードを発行") }
                invitationCode?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(it, style = androidx.compose.material3.MaterialTheme.typography.headlineMedium)
                }
            }
        }
        Spacer(Modifier.height(16.dp))

        Card {
            Column(Modifier.padding(12.dp)) {
                Text("見守り応答")
                Spacer(Modifier.height(8.dp))
                Button(onClick = {
                    scope.launch {
                        runCatching { api.checkin() }
                            .onSuccess { checkinResult = "送信しました" }
                            .onFailure { checkinResult = "エラー: ${it.message}" }
                    }
                }) { Text("元気です") }
                checkinResult?.let { Spacer(Modifier.height(4.dp)); Text(it) }
            }
        }
        Spacer(Modifier.height(16.dp))

        HorizontalDivider()
        Spacer(Modifier.height(16.dp))
        Button(onClick = onSignedOut) { Text("ログアウト") }
    }
}
