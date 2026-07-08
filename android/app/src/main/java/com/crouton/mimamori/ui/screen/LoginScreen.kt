package com.crouton.mimamori.ui.screen

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
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

    Column(Modifier.padding(24.dp).fillMaxWidth()) {
        Text(if (mode == "login") "ログイン" else "アカウント作成")
        Spacer(Modifier.height(12.dp))
        if (mode == "register") {
            Row2(
                left = { RadioButton(selected = role == "watched", onClick = { role = "watched" }) },
                right = { Text("見守られる側") },
            )
            Row2(
                left = { RadioButton(selected = role == "watcher", onClick = { role = "watcher" }) },
                right = { Text("見守る側") },
            )
            OutlinedTextField(name, { name = it }, label = { Text("表示名") }, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
        }
        OutlinedTextField(email, { email = it }, label = { Text("メール") }, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            password, { password = it }, label = { Text("パスワード") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )
        error?.let { Text(it) }
        Spacer(Modifier.height(12.dp))
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
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (busy) CircularProgressIndicator() else Text(if (mode == "login") "ログイン" else "作成")
        }
        Spacer(Modifier.height(8.dp))
        Button(onClick = { mode = if (mode == "login") "register" else "login" }, modifier = Modifier.fillMaxWidth()) {
            Text(if (mode == "login") "アカウントを作成" else "既存アカウントでログイン")
        }
    }
}

@Composable
private fun Row2(left: @Composable () -> Unit, right: @Composable () -> Unit) {
    androidx.compose.foundation.layout.Row(verticalAlignment = Alignment.CenterVertically) {
        left()
        right()
    }
}
