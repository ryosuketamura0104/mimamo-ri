package com.crouton.mimamori.ui.screen

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.crouton.mimamori.api.ApiClient
import com.crouton.mimamori.auth.FirebaseAuthProvider
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * メール+パスワードでログインまたは新規登録。
 * 新規登録時に role を選ばせ、サーバー側にも users を登録する。
 */
@Composable
fun LoginScreen(onLoggedIn: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf("login") } // login | register
    var role by remember { mutableStateOf("watched") } // watched | watcher
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(Modifier.fillMaxSize().padding(24.dp)) {
        Spacer(Modifier.height(24.dp))
        Text(
            "mimamo-ri",
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            "一人暮らしの毎日を、そっと見守る",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(28.dp))

        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            SegmentedButton(
                selected = mode == "login",
                onClick = { mode = "login" },
                shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2),
            ) { Text("ログイン") }
            SegmentedButton(
                selected = mode == "register",
                onClick = { mode = "register" },
                shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2),
            ) { Text("新規登録") }
        }
        Spacer(Modifier.height(20.dp))

        if (mode == "register") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                RadioButton(selected = role == "watched", onClick = { role = "watched" })
                Text("見守られる側", style = MaterialTheme.typography.bodyLarge)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                RadioButton(selected = role == "watcher", onClick = { role = "watcher" })
                Text("見守る側", style = MaterialTheme.typography.bodyLarge)
            }
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                name,
                { name = it },
                label = { Text("表示名") },
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
        }
        OutlinedTextField(
            email,
            { email = it },
            label = { Text("メールアドレス") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            password,
            { password = it },
            label = { Text("パスワード(8文字以上)") },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(),
        )
        error?.let {
            Spacer(Modifier.height(8.dp))
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
        Spacer(Modifier.height(20.dp))
        Button(
            enabled = !busy && email.isNotBlank() && password.length >= 8,
            onClick = {
                busy = true
                error = null
                scope.launch {
                    try {
                        val auth = FirebaseAuth.getInstance()
                        if (mode == "login") {
                            auth.signInWithEmailAndPassword(email, password).await()
                        } else {
                            auth.createUserWithEmailAndPassword(email, password).await()
                            // サーバー側 users 登録
                            val api = ApiClient(FirebaseAuthProvider())
                            api.registerUser(role, name.ifBlank { email.substringBefore("@") }, email)
                            api.close()
                        }
                        onLoggedIn()
                    } catch (t: Throwable) {
                        error = t.message
                    } finally {
                        busy = false
                    }
                }
            },
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth().height(56.dp),
        ) {
            if (busy) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp,
                )
            } else {
                Text(if (mode == "login") "ログイン" else "アカウントを作成", fontSize = 17.sp)
            }
        }
        Spacer(Modifier.height(8.dp))
        TextButton(
            onClick = { mode = if (mode == "login") "register" else "login" },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (mode == "login") "はじめての方はこちら" else "既存アカウントでログイン")
        }
    }
}
