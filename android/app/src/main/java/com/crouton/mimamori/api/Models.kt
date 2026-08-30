package com.crouton.mimamori.api

import kotlinx.serialization.Serializable

@Serializable
data class SignalReport(
    val type: String,
    val observedAt: String, // ISO 8601 (Instant.toString())
    val deviceId: String? = null,
    val meta: Map<String, String>? = null,
)

@Serializable
data class SignalsBatch(val signals: List<SignalReport>)

@Serializable
data class SignalsResponse(
    val inserted: Int,
    val resolvedEscalationId: String? = null,
)

@Serializable
data class InvitationResponse(
    val code: String,
    val expiresAt: String,
)

@Serializable
data class WatchSettingsDto(
    val thresholdHours: Int,
    val quietStart: String,
    val quietEnd: String,
    val activityIntervalHours: Int,
    val timezone: String,
)

@Serializable
data class MessageDto(
    val id: String,
    val body: String,
    val createdAt: String,
)

@Serializable
data class MessagesResponse(val messages: List<MessageDto>)

@Serializable
data class WeatherDto(
    val condition: String,
    val temperatureC: Double,
)

@Serializable
data class WeatherResponse(val weather: WeatherDto)

@Serializable
data class EntitlementDto(
    val entitlement: String,
    val active: Boolean,
    val freeTierPairLimit: Int,
)
