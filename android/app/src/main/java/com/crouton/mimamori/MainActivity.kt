package com.crouton.mimamori

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.crouton.mimamori.push.PushTokenRegistrar
import com.crouton.mimamori.ui.screen.HomeScreen
import com.crouton.mimamori.ui.screen.LoginScreen
import com.crouton.mimamori.ui.theme.MimamoriTheme
import com.google.firebase.auth.FirebaseAuth

/**
 * 現時点では画面遷移はごく単純: ログイン状態で分岐。
 * 見守られる側/見守る側のロール別 UI はロール決定後に切り替える。
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MimamoriTheme {
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

    // ログイン確立時(起動時に既ログインの場合を含む)に FCM トークンをサーバーへ登録する。
    // onNewToken はログイン前に発火し得るため、ここでの毎回登録でトークン変化に頑健にする
    LaunchedEffect(loggedIn) {
        if (loggedIn) {
            runCatching { PushTokenRegistrar.registerCurrentToken() }
        }
    }

    if (!loggedIn) {
        LoginScreen(onLoggedIn = { loggedIn = true })
    } else {
        HomeScreen(onSignedOut = {
            auth.signOut()
            loggedIn = false
        })
    }
}
