package com.crouton.mimamori

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.crouton.mimamori.signal.UsageStatsCollector
import com.crouton.mimamori.ui.screen.HomeScreen
import com.crouton.mimamori.ui.screen.LoginScreen
import com.google.firebase.auth.FirebaseAuth

/**
 * 現時点では画面遷移はごく単純: ログイン状態で分岐。
 * 見守られる側/見守る側のロール別 UI はロール決定後に切り替える。
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Scaffold { padding ->
                    Column(Modifier.fillMaxSize().padding(padding)) {
                        RootNav()
                    }
                }
            }
        }
    }
}

@Composable
private fun RootNav() {
    val auth = FirebaseAuth.getInstance()
    var loggedIn by remember { mutableStateOf(auth.currentUser != null) }
    if (!loggedIn) {
        LoginScreen(onLoggedIn = { loggedIn = true })
    } else {
        HomeScreen(onSignedOut = {
            auth.signOut()
            loggedIn = false
        })
    }
}

@Composable
fun UsageAccessSection() {
    val ctx = LocalContext.current
    val granted = remember { UsageStatsCollector.hasPermission(ctx) }
    Column {
        Text(
            if (granted) "使用状況アクセス: 許可済み"
            else "使用状況アクセスが未許可です",
            style = MaterialTheme.typography.bodyMedium,
        )
        Spacer(Modifier.height(8.dp))
        if (!granted) {
            Button(onClick = {
                ctx.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
            }) { Text("設定を開く") }
        }
    }
}
