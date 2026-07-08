package com.crouton.mimamori.auth

import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await

/**
 * Firebase Auth の IDトークン取得を抽象化。
 * API 呼び出しごとにキャッシュ済み/リフレッシュ済みのトークンを返す。
 */
interface AuthProvider {
    suspend fun getIdToken(): String
    fun currentUserId(): String?
}

class FirebaseAuthProvider(private val auth: FirebaseAuth = FirebaseAuth.getInstance()) : AuthProvider {
    override suspend fun getIdToken(): String {
        val user = auth.currentUser ?: error("未ログイン")
        val result = user.getIdToken(false).await()
        return result.token ?: error("IDトークン取得失敗")
    }
    override fun currentUserId(): String? = auth.currentUser?.uid
}
