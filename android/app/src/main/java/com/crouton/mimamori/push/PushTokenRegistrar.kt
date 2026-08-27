package com.crouton.mimamori.push

import com.crouton.mimamori.api.ApiClient
import com.crouton.mimamori.auth.FirebaseAuthProvider
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await

/**
 * FCM デバイストークンのサーバー登録。
 * onNewToken はログイン前に発火し得るため、ログイン確立時・アプリ起動時にも
 * 現在のトークンを取得して毎回登録し、トークン変化に頑健にする(サーバー側 upsert 前提)。
 */
object PushTokenRegistrar {

    /** ログイン済みであれば現在の FCM トークンを取得してサーバーへ登録する。 */
    suspend fun registerCurrentToken() {
        val auth = FirebaseAuthProvider()
        if (auth.currentUserId() == null) return
        val token = FirebaseMessaging.getInstance().token.await()
        registerToken(token)
    }

    /** 指定トークンをサーバーへ登録する(onNewToken からも使用)。未ログインなら何もしない。 */
    suspend fun registerToken(token: String) {
        val auth = FirebaseAuthProvider()
        if (auth.currentUserId() == null) return
        val api = ApiClient(auth)
        try {
            api.registerDevice(token)
        } finally {
            api.close()
        }
    }
}
