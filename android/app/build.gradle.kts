plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.crouton.mimamori"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.crouton.mimamori"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        vectorDrawables { useSupportLibrary = true }

        // API のベース URL(端末から見たサーバー)。開発は adb reverse or 実機 IP を想定
        buildConfigField("String", "API_BASE_URL", "\"${project.findProperty("API_BASE_URL") ?: "http://10.0.2.2:3000"}\"")
        // ローカル開発: Firebase Auth エミュレータのホスト(空なら本番 Firebase を使用)
        buildConfigField("String", "AUTH_EMULATOR_HOST", "\"${project.findProperty("AUTH_EMULATOR_HOST") ?: ""}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    // Compose
    implementation(platform("androidx.compose:compose-bom:2024.11.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.navigation:navigation-compose:2.8.4")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // Lifecycle / ViewModel
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")

    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:33.6.0"))
    implementation("com.google.firebase:firebase-auth-ktx")
    implementation("com.google.firebase:firebase-messaging-ktx")

    // WorkManager
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    // Ktor(APIクライアント)
    implementation("io.ktor:ktor-client-core:3.0.1")
    implementation("io.ktor:ktor-client-okhttp:3.0.1")
    implementation("io.ktor:ktor-client-content-negotiation:3.0.1")
    implementation("io.ktor:ktor-serialization-kotlinx-json:3.0.1")

    // シリアライゼーション
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

    // DataStore(シグナルキュー永続化)
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // Glance Widget
    implementation("androidx.glance:glance-appwidget:1.1.1")
    implementation("androidx.glance:glance-material3:1.1.1")

    // RevenueCat
    implementation("com.revenuecat.purchases:purchases:8.10.5")
}
