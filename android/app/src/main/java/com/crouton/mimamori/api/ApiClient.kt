package com.crouton.mimamori.api

import com.crouton.mimamori.BuildConfig
import com.crouton.mimamori.auth.AuthProvider
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.header
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.URLProtocol
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

/**
 * サーバー API 通信クライアント。
 * 全リクエストで Firebase の IDトークンを Bearer で送信する。
 */
class ApiClient(private val auth: AuthProvider) {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = false
    }

    private val http: HttpClient = HttpClient(OkHttp) {
        install(ContentNegotiation) { json(json) }
        install(HttpTimeout) {
            requestTimeoutMillis = 15_000
            connectTimeoutMillis = 5_000
        }
        defaultRequest {
            url(BuildConfig.API_BASE_URL)
        }
    }

    private suspend inline fun authedHeader(): String = "Bearer ${auth.getIdToken()}"

    suspend fun registerUser(role: String, name: String, email: String?) =
        http.post("/api/v1/users/register") {
            header(HttpHeaders.Authorization, authedHeader())
            contentType(ContentType.Application.Json)
            setBody(mapOf("role" to role, "name" to name, "email" to email))
        }.body<Map<String, Any?>>()

    suspend fun registerDevice(pushToken: String) =
        http.post("/api/v1/devices") {
            header(HttpHeaders.Authorization, authedHeader())
            contentType(ContentType.Application.Json)
            setBody(mapOf(
                "platform" to "android",
                "pushToken" to pushToken,
                "appVersion" to BuildConfig.VERSION_NAME,
                "osVersion" to android.os.Build.VERSION.SDK_INT.toString(),
            ))
        }

    suspend fun postSignals(signals: List<SignalReport>) =
        http.post("/api/v1/signals") {
            header(HttpHeaders.Authorization, authedHeader())
            contentType(ContentType.Application.Json)
            setBody(SignalsBatch(signals))
        }.body<SignalsResponse>()

    suspend fun checkin() =
        http.post("/api/v1/checkin") {
            header(HttpHeaders.Authorization, authedHeader())
            contentType(ContentType.Application.Json)
            setBody("{}")
        }.body<Map<String, String?>>()

    suspend fun createInvitation(): InvitationResponse =
        http.post("/api/v1/invitations") {
            header(HttpHeaders.Authorization, authedHeader())
            contentType(ContentType.Application.Json)
            setBody("{}")
        }.body()

    suspend fun getMySettings(): WatchSettingsDto =
        http.get("/api/v1/watched/me/settings") {
            header(HttpHeaders.Authorization, authedHeader())
        }.body()

    suspend fun getMyMessages(limit: Int = 1): MessagesResponse =
        http.get("/api/v1/messages?limit=$limit") {
            header(HttpHeaders.Authorization, authedHeader())
        }.body()

    suspend fun getEntitlement(): EntitlementDto =
        http.get("/api/v1/entitlement/me") {
            header(HttpHeaders.Authorization, authedHeader())
        }.body()

    fun close() = http.close()
}
