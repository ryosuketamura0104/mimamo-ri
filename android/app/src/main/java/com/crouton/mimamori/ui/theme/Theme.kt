package com.crouton.mimamori.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * 深いエメラルドグリーンをブランドカラーとした Material 3 カラースキーム。
 * dynamic color は使わず、ライト/ダークともブランド色を固定で適用する。
 */
private val EmeraldLight = lightColorScheme(
    primary = Color(0xFF047857),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFA7F3D0),
    onPrimaryContainer = Color(0xFF03301F),
    secondary = Color(0xFF4C6359),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFCFE9DB),
    onSecondaryContainer = Color(0xFF092017),
    tertiary = Color(0xFF3E6374),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFC2E8FB),
    onTertiaryContainer = Color(0xFF001F2A),
    background = Color(0xFFF6FBF8),
    onBackground = Color(0xFF0F1F1A),
    surface = Color(0xFFF6FBF8),
    onSurface = Color(0xFF0F1F1A),
    surfaceVariant = Color(0xFFDBE5DE),
    onSurfaceVariant = Color(0xFF3F4944),
    outline = Color(0xFF6F7973),
    outlineVariant = Color(0xFFBFC9C2),
    surfaceTint = Color(0xFF047857),
    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFEFF6F1),
    surfaceContainer = Color(0xFFE9F1EB),
    surfaceContainerHigh = Color(0xFFE3ECE6),
    surfaceContainerHighest = Color(0xFFDDE6E0),
)

private val EmeraldDark = darkColorScheme(
    primary = Color(0xFF34D399),
    onPrimary = Color(0xFF003826),
    primaryContainer = Color(0xFF005141),
    onPrimaryContainer = Color(0xFFA7F3D0),
    secondary = Color(0xFFB3CCBE),
    onSecondary = Color(0xFF1F352A),
    secondaryContainer = Color(0xFF354B40),
    onSecondaryContainer = Color(0xFFCFE9DB),
    tertiary = Color(0xFFA6CCE0),
    onTertiary = Color(0xFF093544),
    tertiaryContainer = Color(0xFF254B5B),
    onTertiaryContainer = Color(0xFFC2E8FB),
    background = Color(0xFF0C1512),
    onBackground = Color(0xFFDCE7E1),
    surface = Color(0xFF0C1512),
    onSurface = Color(0xFFDCE7E1),
    surfaceVariant = Color(0xFF3F4944),
    onSurfaceVariant = Color(0xFFBFC9C2),
    outline = Color(0xFF89938D),
    outlineVariant = Color(0xFF3F4944),
    surfaceTint = Color(0xFF34D399),
    surfaceContainerLowest = Color(0xFF071009),
    surfaceContainerLow = Color(0xFF111A16),
    surfaceContainer = Color(0xFF15201B),
    surfaceContainerHigh = Color(0xFF1F2B25),
    surfaceContainerHighest = Color(0xFF2A362F),
)

@Composable
fun MimamoriTheme(content: @Composable () -> Unit) {
    val colorScheme = if (isSystemInDarkTheme()) EmeraldDark else EmeraldLight
    MaterialTheme(
        colorScheme = colorScheme,
        content = content,
    )
}
